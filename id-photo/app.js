/* 证件照像素调整 · 纯前端本地处理，全程不发起任何网络请求 */
(function () {
  'use strict';

  // ===== 常量 =====
  var PRESETS = {
    '300x420': [300, 420],
    '295x413': [295, 413],
    '413x579': [413, 579],
    '413x531': [413, 531]
  };
  var MIN_SIDE = 50;
  var MAX_SIDE = 2000;
  var PREVIEW_MAX = 1600;   // 预览降采样最长边
  var SCALE_MIN = 0.2;
  var SCALE_MAX = 8;
  var SIZE_ERROR = '宽和高请填 50 到 2000 之间的整数。';
  var DECODE_ERROR = '这张照片格式无法读取，请在手机相册里先导出为 JPG 再试一次。';
  var SIZE_KEY = 'id_photo_size_v1'; // 只记住上次选择的尺寸，不含照片等敏感内容
  var OFFSET_LIMIT = 2.5;            // 归一化平移上限（约两个半框），避免拖出画面后导出空白

  var MODE_TIPS = {
    cover: '等比放大铺满画面，多余部分自动裁掉，不会变形。',
    contain: '整张照片完整放进框内，四周用底色补上，不会裁切。',
    stretch: '直接拉伸到目标尺寸，画面会变形，一般不用。'
  };

  // ===== 状态 =====
  var state = {
    mode: 'cover',
    bg: '#FFFFFF',
    rotation: 0,          // 0 / 90 / 180 / 270
    flipX: false,
    userScale: 1,         // 在基础缩放之上的用户缩放
    offsetX: 0,           // 归一化平移量：相对目标框宽度（1 = 一个框宽，屏幕方向）
    offsetY: 0,           // 归一化平移量：相对目标框高度
    targetWidth: 300,
    targetHeight: 420,
    format: 'jpeg',
    quality: 0.92,
    showGuides: true
  };

  var source = null;          // 原始解码位图（导出使用，保证像素精确）
  var previewSource = null;   // 预览用位图（超大图会降采样）
  var sourceObjectUrl = null; // 回退解码时创建的 blob URL，用于释放
  var srcW = 0, srcH = 0;     // 原始位图像素尺寸
  var currentStep = 1;
  var resultUrl = null;       // 结果预览的 blob URL

  var els = {};
  var pointers = new Map();
  var dragStart = null;
  var pinchStart = null;

  // ===== 基础工具 =====
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function $(id) { return document.getElementById(id); }

  function bitmapSize(b) {
    return { w: b.naturalWidth || b.width, h: b.naturalHeight || b.height };
  }

  // 图片按旋转后的有效宽高（90/270 时宽高互换）
  function rotatedSize() {
    return state.rotation % 180 !== 0 ? { w: srcH, h: srcW } : { w: srcW, h: srcH };
  }

  // 三种模式的基础缩放（x/y 分开，仅 stretch 会不等）
  function baseScales() {
    var r = rotatedSize();
    var TW = state.targetWidth, TH = state.targetHeight;
    if (!r.w || !r.h) return { x: 1, y: 1 };
    if (state.mode === 'contain') {
      var s = Math.min(TW / r.w, TH / r.h);
      return { x: s, y: s };
    }
    if (state.mode === 'stretch') {
      return { x: TW / r.w, y: TH / r.h };
    }
    var c = Math.max(TW / r.w, TH / r.h); // cover
    return { x: c, y: c };
  }

  // ===== 绘制：把目标框（TW×TH，输出像素）渲染到 outW×outH 画布 =====
  function drawScene(ctx, bitmap, outW, outH) {
    var TW = state.targetWidth, TH = state.targetHeight;
    var kx = outW / TW, ky = outH / TH;

    // 底色（也用作留白填充）
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = state.bg;
    ctx.fillRect(0, 0, outW, outH);

    if (!bitmap || !srcW || !srcH) return;

    var bs = baseScales();
    var sx = bs.x * state.userScale * kx;
    var sy = bs.y * state.userScale * ky;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // 先位移（含用户平移，归一化后按输出尺寸换算），再旋转、镜像、缩放
    ctx.translate(outW / 2 + state.offsetX * outW, outH / 2 + state.offsetY * outH);
    if (state.rotation) ctx.rotate((state.rotation * Math.PI) / 180);
    if (state.flipX) ctx.scale(-1, 1);
    ctx.scale(sx, sy);
    // 以原始位图逻辑尺寸居中绘制（previewSource 可能更小，会被等比放大）
    ctx.drawImage(bitmap, -srcW / 2, -srcH / 2, srcW, srcH);
    ctx.restore();
  }

  // ===== 预览尺寸与绘制 =====
  function layoutViewfinder() {
    var stage = els.stage;
    if (!stage) return;
    var availW = stage.clientWidth || (els.app.clientWidth - 24);
    if (availW <= 0) return; // 面板隐藏时不排版
    var ratio = state.targetWidth / state.targetHeight;
    var maxH = Math.max(180, Math.round(window.innerHeight * 0.55));
    var w = availW;
    var h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    els.viewfinder.style.width = Math.round(w) + 'px';
    els.viewfinder.style.height = Math.round(h) + 'px';
  }

  function renderPreview() {
    var vf = els.viewfinder, canvas = els.previewCanvas;
    if (!vf || !canvas) return;
    var cssW = vf.clientWidth, cssH = vf.clientHeight;
    if (!cssW || !cssH) return;
    var dpr = window.devicePixelRatio || 1;
    var bw = Math.max(1, Math.round(cssW * dpr));
    var bh = Math.max(1, Math.round(cssH * dpr));
    canvas.width = bw;
    canvas.height = bh;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    drawScene(canvas.getContext('2d'), source ? previewSource : null, bw, bh);
  }

  // ===== 解码 =====
  function decodeViaImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.src = url;
      if (typeof img.decode === 'function') {
        img.decode().then(function () { resolve(img); }, reject);
      } else {
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('image-load-failed')); };
      }
    });
  }

  // 优先 createImageBitmap（自动按 EXIF 方向纠正），失败回退 new Image()
  function decodeFile(file) {
    var useBitmap = typeof createImageBitmap === 'function';
    var first = useBitmap
      ? createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return null; })
      : Promise.resolve(null);

    return first.then(function (bitmap) {
      if (bitmap) return { bitmap: bitmap, url: null };
      var url = URL.createObjectURL(file);
      return decodeViaImage(url).then(function (img) {
        return { bitmap: img, url: url };
      }, function (err) {
        URL.revokeObjectURL(url);
        throw err;
      });
    });
  }

  // 超大图生成降采样预览副本（导出仍用原始位图）
  function makePreviewSource(bitmap, w, h) {
    var longest = Math.max(w, h);
    if (longest <= PREVIEW_MAX) return bitmap;
    var scale = PREVIEW_MAX / longest;
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    return c;
  }

  function releaseSource() {
    if (source && typeof source.close === 'function') {
      try { source.close(); } catch (e) { /* 忽略 */ }
    }
    if (sourceObjectUrl) {
      URL.revokeObjectURL(sourceObjectUrl);
      sourceObjectUrl = null;
    }
    source = null;
    previewSource = null;
    srcW = 0;
    srcH = 0;
  }

  function setSource(decoded) {
    releaseSource();
    source = decoded.bitmap;
    sourceObjectUrl = decoded.url || null;
    var sz = bitmapSize(source);
    srcW = sz.w;
    srcH = sz.h;
    previewSource = makePreviewSource(source, srcW, srcH);
    // 新照片重置变换
    state.rotation = 0;
    state.flipX = false;
    state.userScale = 1;
    state.offsetX = 0;
    state.offsetY = 0;
    syncZoomSlider();
  }

  // ===== 错误提示 =====
  function showStep1Error(msg) {
    els.step1Error.textContent = msg;
    els.step1Error.hidden = false;
  }
  function clearStep1Error() {
    els.step1Error.hidden = true;
    els.step1Error.textContent = '';
  }

  // ===== 步骤切换 =====
  function goStep(n) {
    currentStep = n;
    els.panel1.hidden = n !== 1;
    els.panel2.hidden = n !== 2;
    els.panel3.hidden = n !== 3;

    var btns = els.steps.querySelectorAll('.step');
    for (var i = 0; i < btns.length; i++) {
      var s = Number(btns[i].dataset.step);
      btns[i].classList.toggle('active', s === n);
      btns[i].classList.toggle('done', s < n);
      btns[i].disabled = s === 1 ? false : !source;
    }

    if (n === 2) {
      layoutViewfinder();
      renderPreview();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ===== 模式 / 底色 / 引导线 =====
  function setMode(mode) {
    if (mode !== 'cover' && mode !== 'contain' && mode !== 'stretch') return;
    state.mode = mode;
    var btns = els.modeSeg.querySelectorAll('.seg-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.mode === mode);
    }
    els.modeTip.textContent = MODE_TIPS[mode];
    els.bgRow.hidden = mode !== 'contain';
    renderPreview();
  }

  function setBg(color) {
    state.bg = color;
    var items = els.bgRow.querySelectorAll('.swatch');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].dataset.bg === color);
    }
    renderPreview();
  }

  function setGuidesVisible(show) {
    state.showGuides = show;
    els.guides.hidden = !show;
    els.guidesToggle.textContent = show ? '隐藏参考线' : '显示参考线';
  }

  // ===== 缩放滑杆 =====
  function syncZoomSlider() {
    els.zoomSlider.value = String(clamp(state.userScale, 0.4, 4));
    els.zoomVal.textContent = Math.round(state.userScale * 100) + '%';
  }

  // ===== 目标尺寸 =====
  function clampInt(v) {
    var n = parseInt(v, 10);
    if (!isFinite(n)) return null;
    return clamp(Math.round(n), MIN_SIDE, MAX_SIDE);
  }

  function presetFor(w, h) {
    return PRESETS[w + 'x' + h] ? w + 'x' + h : 'custom';
  }

  function validTargetSize() {
    var w = state.targetWidth, h = state.targetHeight;
    return isFinite(w) && isFinite(h) && w >= MIN_SIDE && w <= MAX_SIDE && h >= MIN_SIDE && h <= MAX_SIDE;
  }

  function aspectChanged(oldW, oldH, w, h) {
    var oldR = oldW / oldH;
    var newR = w / h;
    return Math.abs(newR - oldR) / oldR > 0.01; // 宽高比差异 > 1% 才提示
  }

  function updateSizeSummary() {
    if (els.sizeSummary) {
      els.sizeSummary.textContent = state.targetWidth + '×' + state.targetHeight + ' px';
    }
  }

  function setResizeNotice(oldW, oldH, w, h) {
    if (!els.resizeNotice) return;
    if (aspectChanged(oldW, oldH, w, h)) {
      els.resizeNotice.textContent = '已按新尺寸重新取景（' + w + '×' + h + '），请确认构图';
      els.resizeNotice.hidden = false;
    } else {
      els.resizeNotice.hidden = true;
    }
  }

  function hideResizeNotice() {
    if (els.resizeNotice) els.resizeNotice.hidden = true;
  }

  function persistSize(w, h) {
    try { localStorage.setItem(SIZE_KEY, w + 'x' + h); } catch (e) { /* 隐私模式等忽略 */ }
  }

  function readSavedSize() {
    try {
      var m = /^(\d{2,4})x(\d{2,4})$/.exec(localStorage.getItem(SIZE_KEY) || '');
      if (!m) return null;
      var w = clampInt(m[1]), h = clampInt(m[2]);
      return (w === null || h === null) ? null : [w, h];
    } catch (e) { return null; }
  }

  function setSize(w, h) {
    var cw = clampInt(w), ch = clampInt(h);
    if (cw === null || ch === null) return;
    var oldW = state.targetWidth, oldH = state.targetHeight;
    state.targetWidth = cw;
    state.targetHeight = ch;
    var key = presetFor(cw, ch);
    els.sizePreset.value = key;
    els.customSize.hidden = key !== 'custom';
    els.customW.value = String(cw);
    els.customH.value = String(ch);
    updateSizeValidity();
    updateSizeSummary();
    setResizeNotice(oldW, oldH, cw, ch);
    persistSize(cw, ch);
    layoutViewfinder();
    renderPreview();
  }

  function updateSizeValidity() {
    if (els.sizePreset.value !== 'custom') {
      els.sizeError.hidden = true;
      els.exportBtn.disabled = false;
      return;
    }
    var w = parseInt(els.customW.value, 10);
    var h = parseInt(els.customH.value, 10);
    var ok = isFinite(w) && isFinite(h) && w >= MIN_SIDE && w <= MAX_SIDE && h >= MIN_SIDE && h <= MAX_SIDE;
    if (!ok) {
      els.sizeError.textContent = SIZE_ERROR;
      els.sizeError.hidden = false;
      els.exportBtn.disabled = true;
      return;
    }
    els.sizeError.hidden = true;
    els.exportBtn.disabled = false;
    var oldW = state.targetWidth, oldH = state.targetHeight;
    state.targetWidth = Math.round(w);
    state.targetHeight = Math.round(h);
    updateSizeSummary();
    setResizeNotice(oldW, oldH, state.targetWidth, state.targetHeight);
    persistSize(state.targetWidth, state.targetHeight);
    layoutViewfinder();
    renderPreview();
  }

  // 初始化目标尺寸：读取上次选择（无则 300×420），不弹「重新取景」提示
  function initSize() {
    var saved = readSavedSize() || [300, 420];
    state.targetWidth = saved[0];
    state.targetHeight = saved[1];
    var key = presetFor(saved[0], saved[1]);
    els.sizePreset.value = key;
    els.customSize.hidden = key !== 'custom';
    els.customW.value = String(saved[0]);
    els.customH.value = String(saved[1]);
    updateSizeValidity();
    updateSizeSummary();
    hideResizeNotice();
  }

  // ===== 格式 / 画质 =====
  function setFormat(fmt) {
    state.format = fmt === 'png' ? 'png' : 'jpeg';
    els.formatSelect.value = state.format;
    els.qualityField.hidden = state.format === 'png';
  }

  function setQuality(q) {
    state.quality = clamp(Number(q) || 0, 0.5, 1);
    els.qualitySlider.value = String(state.quality);
    els.qualityVal.textContent = state.quality.toFixed(2);
  }

  // ===== 导出 =====
  function exportToBlob() {
    return new Promise(function (resolve, reject) {
      if (!source) { reject(new Error('no-source')); return; }
      if (!validTargetSize()) { reject(new Error('bad-size')); return; }
      var c = document.createElement('canvas');
      c.width = state.targetWidth;
      c.height = state.targetHeight;
      var ctx = c.getContext('2d');
      drawScene(ctx, source, c.width, c.height); // 用原始位图，像素精确
      var mime = state.format === 'png' ? 'image/png' : 'image/jpeg';
      var q = state.format === 'png' ? undefined : state.quality;
      c.toBlob(function (blob) {
        if (!blob) { reject(new Error('toBlob-failed')); return; }
        resolve(blob);
      }, mime, q);
    });
  }

  function doExport() {
    els.exportBtn.disabled = true;
    return exportToBlob().then(function (blob) {
      var ext = state.format === 'png' ? 'png' : 'jpg';
      var name = '证件照_' + state.targetWidth + 'x' + state.targetHeight + '.' + ext;
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(blob);
      els.resultImg.src = resultUrl;
      var kb = Math.max(1, Math.round(blob.size / 1024));
      els.resultInfo.textContent = '输出 ' + state.targetWidth + '×' + state.targetHeight + ' px · ' + kb + ' KB';
      els.downloadBtn.href = resultUrl;
      els.downloadBtn.download = name;
      els.result.hidden = false;
      els.exportBtn.disabled = false;
    }).catch(function () {
      els.exportBtn.disabled = false;
    });
  }

  // ===== 快捷操作 =====
  function doAction(act) {
    if (act === 'centerX') state.offsetX = 0;
    else if (act === 'centerY') state.offsetY = 0;
    else if (act === 'fill') {
      state.mode = 'cover'; state.userScale = 1; state.offsetX = 0; state.offsetY = 0;
      setMode('cover');
    }
    else if (act === 'zoomIn') state.userScale = clamp(state.userScale * 1.1, SCALE_MIN, SCALE_MAX);
    else if (act === 'zoomOut') state.userScale = clamp(state.userScale / 1.1, SCALE_MIN, SCALE_MAX);
    else if (act === 'rotate') state.rotation = (state.rotation + 90) % 360;
    else if (act === 'flip') state.flipX = !state.flipX;
    else if (act === 'reset') {
      state.rotation = 0; state.flipX = false; state.userScale = 1; state.offsetX = 0; state.offsetY = 0;
    }
    syncZoomSlider();
    hideResizeNotice();
    renderPreview();
  }

  // ===== 手势（Pointer Events 统一鼠标 / 触摸 / 触控笔）=====
  function twoPointerDist() {
    var arr = Array.from(pointers.values());
    var dx = arr[0].x - arr[1].x;
    var dy = arr[0].y - arr[1].y;
    return Math.sqrt(dx * dx + dy * dy) || 1;
  }

  function onPointerDown(e) {
    if (!source) return;
    e.preventDefault();
    els.viewfinder.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragStart = { x: e.clientX, y: e.clientY, offsetX: state.offsetX, offsetY: state.offsetY };
      pinchStart = null;
    } else if (pointers.size === 2) {
      dragStart = null;
      pinchStart = { dist: twoPointerDist(), scale: state.userScale };
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2 && pinchStart) {
      var d = twoPointerDist();
      state.userScale = clamp(pinchStart.scale * (d / pinchStart.dist), SCALE_MIN, SCALE_MAX);
      syncZoomSlider();
      hideResizeNotice();
      renderPreview();
    } else if (dragStart) {
      // 手指位移按取景框宽高换算成归一化平移量（1 = 一个框宽/高）
      var cw = els.viewfinder.clientWidth || 1;
      var ch = els.viewfinder.clientHeight || 1;
      state.offsetX = clamp(dragStart.offsetX + (e.clientX - dragStart.x) / cw, -OFFSET_LIMIT, OFFSET_LIMIT);
      state.offsetY = clamp(dragStart.offsetY + (e.clientY - dragStart.y) / ch, -OFFSET_LIMIT, OFFSET_LIMIT);
      hideResizeNotice();
      renderPreview();
    }
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) {
      dragStart = null;
    } else if (pointers.size === 1) {
      var p = pointers.values().next().value;
      dragStart = { x: p.x, y: p.y, offsetX: state.offsetX, offsetY: state.offsetY };
    }
  }

  function onWheel(e) {
    if (!source) return;
    e.preventDefault();
    var f = Math.exp(-e.deltaY * 0.0015);
    state.userScale = clamp(state.userScale * f, SCALE_MIN, SCALE_MAX);
    syncZoomSlider();
    hideResizeNotice();
    renderPreview();
  }

  // ===== 载入照片 =====
  function setSourceFromFile(file) {
    if (!file) return Promise.reject(new Error('no-file'));
    return decodeFile(file).then(function (decoded) {
      clearStep1Error();
      setSource(decoded);
      goStep(2);
    }, function () {
      showStep1Error(DECODE_ERROR);
      goStep(1);
      throw new Error('decode-failed');
    });
  }

  function loadFile(file) {
    setSourceFromFile(file).catch(function () { /* 提示已在内部给出 */ });
  }

  // ===== 重来 =====
  function restart() {
    releaseSource();
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    els.result.hidden = true;
    els.resultImg.removeAttribute('src');
    state.rotation = 0; state.flipX = false; state.userScale = 1; state.offsetX = 0; state.offsetY = 0;
    state.mode = 'cover';
    setMode('cover');
    setBg('#FFFFFF');
    setFormat('jpeg');
    setQuality(0.92);
    setSize(300, 420);
    els.sizePreset.value = '300x420';
    els.customSize.hidden = true;
    hideResizeNotice();
    clearStep1Error();
    syncZoomSlider();
    goStep(1);
  }

  // ===== 事件绑定 =====
  function cacheEls() {
    var ids = ['app', 'steps', 'panel1', 'panel2', 'panel3', 'pickArea', 'pickLibrary', 'pickCamera',
      'fileInput', 'cameraInput', 'step1Error', 'modeSeg', 'modeTip', 'bgRow', 'stage', 'viewfinder',
      'previewCanvas', 'guides', 'guidesToggle', 'zoomSlider', 'zoomVal', 'backTo1', 'toStep3',
      'sizePreset', 'customSize', 'customW', 'customH', 'sizeError', 'resizeNotice', 'sizeSummary',
      'formatSelect', 'qualityField', 'editSize',
      'qualitySlider', 'qualityVal', 'exportBtn', 'result', 'resultImg', 'resultInfo', 'downloadBtn',
      'backTo2', 'restart'];
    ids.forEach(function (id) { els[id] = $(id); });
  }

  function bindEvents() {
    els.pickLibrary.addEventListener('click', function () { els.fileInput.click(); });
    els.pickCamera.addEventListener('click', function () { els.cameraInput.click(); });

    [els.fileInput, els.cameraInput].forEach(function (input) {
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        input.value = '';
        if (f) loadFile(f);
      });
    });

    // 拖拽
    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files[0]) return;
      e.preventDefault();
      loadFile(e.dataTransfer.files[0]);
    });

    // 粘贴
    document.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.files;
      if (items && items[0]) loadFile(items[0]);
    });

    // 步骤条
    els.steps.addEventListener('click', function (e) {
      var btn = e.target.closest('.step');
      if (!btn || btn.disabled) return;
      goStep(Number(btn.dataset.step));
    });

    // 模式
    els.modeSeg.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-btn');
      if (btn) setMode(btn.dataset.mode);
    });

    // 底色
    els.bgRow.addEventListener('click', function (e) {
      var btn = e.target.closest('.swatch');
      if (btn) setBg(btn.dataset.bg);
    });

    // 参考线显示
    els.guidesToggle.addEventListener('click', function () { setGuidesVisible(!state.showGuides); });

    // 快捷操作
    var actions = document.querySelector('.actions');
    actions.addEventListener('click', function (e) {
      var btn = e.target.closest('.act');
      if (btn) doAction(btn.dataset.act);
    });

    // 缩放滑杆
    els.zoomSlider.addEventListener('input', function () {
      state.userScale = clamp(Number(els.zoomSlider.value) || 1, SCALE_MIN, SCALE_MAX);
      els.zoomVal.textContent = Math.round(state.userScale * 100) + '%';
      hideResizeNotice();
      renderPreview();
    });

    // 手势
    var vf = els.viewfinder;
    vf.addEventListener('pointerdown', onPointerDown);
    vf.addEventListener('pointermove', onPointerMove);
    vf.addEventListener('pointerup', onPointerUp);
    vf.addEventListener('pointercancel', onPointerUp);
    vf.addEventListener('wheel', onWheel, { passive: false });

    // 步骤导航按钮
    els.backTo1.addEventListener('click', function () { goStep(1); });
    els.toStep3.addEventListener('click', function () { goStep(3); });
    els.backTo2.addEventListener('click', function () { goStep(2); });
    els.editSize.addEventListener('click', function () { goStep(2); });
    els.restart.addEventListener('click', restart);

    // 尺寸
    els.sizePreset.addEventListener('change', function () {
      var v = els.sizePreset.value;
      if (v === 'custom') {
        els.customSize.hidden = false;
        updateSizeValidity();
      } else {
        els.customSize.hidden = true;
        var p = PRESETS[v];
        setSize(p[0], p[1]);
      }
    });
    els.customW.addEventListener('input', updateSizeValidity);
    els.customH.addEventListener('input', updateSizeValidity);

    // 格式 / 画质
    els.formatSelect.addEventListener('change', function () { setFormat(els.formatSelect.value); });
    els.qualitySlider.addEventListener('input', function () { setQuality(els.qualitySlider.value); });

    // 导出
    els.exportBtn.addEventListener('click', function () { doExport(); });

    window.addEventListener('resize', function () {
      if (currentStep === 2) { layoutViewfinder(); renderPreview(); }
    });
  }

  // ===== 调试接口（供自动化测试使用，不影响正常交互）=====
  function setTransform(t) {
    if (!t) return;
    if (typeof t.scale === 'number' && isFinite(t.scale)) state.userScale = clamp(t.scale, SCALE_MIN, SCALE_MAX);
    // 对外语义不变：offsetX/Y 仍按「输出像素」传入，内部换算为归一化平移量
    if (typeof t.offsetX === 'number' && isFinite(t.offsetX)) {
      state.offsetX = clamp(t.offsetX / state.targetWidth, -OFFSET_LIMIT, OFFSET_LIMIT);
    }
    if (typeof t.offsetY === 'number' && isFinite(t.offsetY)) {
      state.offsetY = clamp(t.offsetY / state.targetHeight, -OFFSET_LIMIT, OFFSET_LIMIT);
    }
    if (typeof t.rotation === 'number' && isFinite(t.rotation)) {
      state.rotation = ((Math.round(t.rotation / 90) * 90) % 360 + 360) % 360;
    }
    if (typeof t.flipX === 'boolean') state.flipX = t.flipX;
    syncZoomSlider();
    renderPreview();
  }

  function getState() {
    return {
      mode: state.mode,
      targetWidth: state.targetWidth,
      targetHeight: state.targetHeight,
      formatQuality: state.quality,
      sourceWidth: srcW,
      sourceHeight: srcH,
      naturalWidth: srcW,
      naturalHeight: srcH,
      hasSource: !!source,
      offsetXNorm: state.offsetX,
      offsetYNorm: state.offsetY
    };
  }

  function exposeApi() {
    window.__idPhotoApi = {
      setSourceFromFile: setSourceFromFile,
      setMode: setMode,
      setSize: setSize,
      setQuality: setQuality,
      setFormat: setFormat,
      setTransform: setTransform,
      getState: getState,
      exportToBlob: exportToBlob,
      renderPreview: renderPreview
    };
  }

  // ===== 启动 =====
  function init() {
    cacheEls();
    bindEvents();
    initSize();
    setMode('cover');
    setFormat('jpeg');
    setQuality(0.92);
    setGuidesVisible(true);
    syncZoomSlider();
    exposeApi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
