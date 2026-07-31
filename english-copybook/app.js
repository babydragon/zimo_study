// 英语字帖生成器 —— 前端逻辑
// 流程：用户输入 → Rust/WASM 生成 Typst 源码 → typst.ts 编译为 PDF → 预览/下载

const SAMPLE = `Hello, I am your **friend**.
Look at my **eye** and my **ear**.
I like **apples** and **bananas**.
What is your **name**?
Good morning, **teacher**!
This is a **cat**. That is a **dog**.
Nice to **meet** you, too.
Colour it **red**, please.`;

const STORE_KEY = 'english-copybook/v2';
const LEGACY_STORE_KEY = 'english-copybook/v1';
const BUILD_TAG = '20260707-1030';
const TYPST_COMPILER_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@0.7.0/pkg/typst_ts_web_compiler_bg.wasm';

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const ui = {
  input: $('input'),
  title: $('titleInput'),
  fontSize: $('fontSize'),
  fontSizeVal: $('fontSizeVal'),
  lineSpacing: $('lineSpacing'),
  lineSpacingVal: $('lineSpacingVal'),
  rowGap: $('rowGap'),
  rowGapVal: $('rowGapVal'),
  blockGap: $('blockGap'),
  blockGapVal: $('blockGapVal'),
  margin: $('margin'),
  marginVal: $('marginVal'),
  yOffset: $('yOffset'),
  yOffsetVal: $('yOffsetVal'),
  traceRows: $('traceRows'),
  emptyRows: $('emptyRows'),
  keywordBold: $('keywordBold'),
  showMarkers: $('showMarkers'),
  slantEnabled: $('slantEnabled'),
  slantAngle: $('slantAngle'),
  slantAngleVal: $('slantAngleVal'),
  slantSpacing: $('slantSpacing'),
  slantSpacingVal: $('slantSpacingVal'),
  theme: $('theme'),
  generateBtn: $('generateBtn'),
  advancedToggle: $('advancedToggle'),
  advanced: $('advanced'),
  preview: $('preview'),
  previewWrap: $('previewWrap'),
  downloadBtn: $('downloadBtn'),
  status: $('status'),
  overlay: $('overlay'),
  overlayMsg: $('overlayMsg'),
  resetBtn: $('resetBtn'),
};

// ---------- 状态 ----------
let rustReady = null;   // Promise<wasm 模块>
let typstReady = null;  // Promise<void>
let lastPdfBlobUrl = null;
let lastPdfBytes = null;

// ---------- 持久化 ----------
function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      version: 2,
      input: ui.input.value,
      title: ui.title.value,
      fontSize: ui.fontSize.value,
      lineSpacing: ui.lineSpacing.value,
      rowGap: ui.rowGap.value,
      blockGap: ui.blockGap.value,
      margin: ui.margin.value,
      yOffset: ui.yOffset.value,
      traceRows: ui.traceRows.value,
      emptyRows: ui.emptyRows.value,
      keywordBold: ui.keywordBold.checked,
      showMarkers: ui.showMarkers.checked,
      slantEnabled: ui.slantEnabled.checked,
      slantAngle: ui.slantAngle.value,
      slantSpacing: ui.slantSpacing.value,
      theme: ui.theme.value,
    }));
  } catch (e) { /* localStorage 不可用，忽略 */ }
}

function loadState() {
  let s = null;
  try {
    s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!s) {
      s = JSON.parse(localStorage.getItem(LEGACY_STORE_KEY) || 'null');
      if (s && (s.yOffset === undefined || Number(s.yOffset) === 1.5)) {
        s.yOffset = 0.5;
      }
    }
  } catch (e) {}
  if (!s) return;
  // 迁移：旧的句间距默认值 18 → 新默认 28
  if (Number(s.blockGap) === 18) s.blockGap = 28;
  ui.input.value = s.input ?? SAMPLE;
  ui.title.value = s.title ?? '';
  ui.fontSize.value = s.fontSize ?? 0;
  ui.lineSpacing.value = s.lineSpacing ?? 12;
  ui.rowGap.value = s.rowGap ?? 4;
  ui.blockGap.value = s.blockGap ?? 28;
  ui.margin.value = s.margin ?? 42.5;
  ui.yOffset.value = (s.yOffset === undefined || s.yOffset === null) ? 0.5 : s.yOffset;
  ui.traceRows.value = s.traceRows ?? 1;
  ui.emptyRows.value = s.emptyRows ?? 2;
  ui.keywordBold.checked = s.keywordBold ?? true;
  ui.showMarkers.checked = s.showMarkers ?? true;
  ui.slantEnabled.checked = s.slantEnabled ?? false;
  ui.slantAngle.value = s.slantAngle ?? 12;
  ui.slantSpacing.value = s.slantSpacing ?? 0;
  ui.theme.value = s.theme ?? 'color';
}

// ---------- 滑块实时数值显示 ----------
function bindSliders() {
  const map = [
    [ui.fontSize, ui.fontSizeVal, (v) => v === '0' || v === 0 ? '自动' : v + ' pt'],
    [ui.lineSpacing, ui.lineSpacingVal, (v) => v + ' pt'],
    [ui.rowGap, ui.rowGapVal, (v) => v + ' pt'],
    [ui.blockGap, ui.blockGapVal, (v) => v + ' pt'],
    [ui.margin, ui.marginVal, (v) => v + ' pt'],
    [ui.yOffset, ui.yOffsetVal, (v) => v + ' pt'],
    [ui.slantAngle, ui.slantAngleVal, (v) => v + '°'],
    [ui.slantSpacing, ui.slantSpacingVal, (v) => (v === '0' || v === 0) ? '自动' : v + ' pt'],
  ];
  for (const [el, valEl, fmt] of map) {
    const update = () => { valEl.textContent = fmt(el.value); saveState(); };
    el.addEventListener('input', update);
    update();
  }
  // 复选/下拉变化也保存
  [ui.title, ui.traceRows, ui.emptyRows, ui.keywordBold, ui.showMarkers, ui.slantEnabled, ui.theme, ui.input]
    .forEach((el) => el.addEventListener('change', saveState));
  ui.input.addEventListener('input', saveState);
}

// ---------- 收集参数 ----------
function collectParams() {
  return {
    title: ui.title.value.trim() || null,
    font_size: parseFloat(ui.fontSize.value) || 0,
    line_spacing: parseFloat(ui.lineSpacing.value),
    row_gap: parseFloat(ui.rowGap.value),
    block_gap: parseFloat(ui.blockGap.value),
    margin: parseFloat(ui.margin.value),
    y_offset: parseFloat(ui.yOffset.value),
    trace_rows: parseInt(ui.traceRows.value, 10) || 0,
    empty_rows: parseInt(ui.emptyRows.value, 10) || 0,
    keyword_bold: ui.keywordBold.checked,
    show_markers: ui.showMarkers.checked,
    slant_enabled: ui.slantEnabled.checked,
    slant_angle: parseFloat(ui.slantAngle.value),
    slant_spacing: parseFloat(ui.slantSpacing.value),
    font_name: 'EnCopybook',
    theme: ui.theme.value,
  };
}

// ---------- Rust/WASM 加载（懒） ----------
function ensureRust() {
  if (!rustReady) {
    rustReady = (async () => {
      const mod = await import(`./wasm/english_copybook_core.js?v=${BUILD_TAG}`);
      await mod.default(`./wasm/english_copybook_core_bg.wasm?v=${BUILD_TAG}`);
      return mod;
    })();
  }
  return rustReady;
}

// ---------- typst.ts 加载（懒） ----------
function ensureTypst() {
  if (!typstReady) {
    typstReady = (async () => {
      showOverlay('正在加载排版引擎（首次约 28MB，请稍候）…');
      // 加载 all-in-one bundle（设置 window.$typst / window.TypstSnippet）
      await import(`./vendor/typst-all-in-one-lite.bundle.js?v=${BUILD_TAG}`);
      const $typst = window.$typst;
      const TypstSnippet = window.TypstSnippet;
      if (!$typst || !TypstSnippet) {
        throw new Error('typst.ts 引擎加载失败');
      }
      $typst.setCompilerInitOptions({
        getModule: () => TYPST_COMPILER_WASM_CDN,
      });
      // 预加载字体：正文 / 中文标题 / emoji 标记
      const fontUrls = [
        './fonts/EnCopybook.ttf',
        './fonts/ARPLKaitiMGB.ttf',
        './fonts/NotoEmoji-Regular.ttf',
      ];
      for (const rel of fontUrls) {
        const fontResp = await fetch(new URL(`${rel}?v=${BUILD_TAG}`, location.href).href);
        if (!fontResp.ok) throw new Error(`字体加载失败：${rel}`);
        const fontBytes = new Uint8Array(await fontResp.arrayBuffer());
        $typst.use(TypstSnippet.preloadFontData(fontBytes));
      }
      hideOverlay();
    })();
  }
  return typstReady;
}

function showOverlay(msg) {
  ui.overlayMsg.textContent = msg;
  ui.overlay.classList.remove('hidden');
}
function hideOverlay() {
  ui.overlay.classList.add('hidden');
}
function setStatus(msg, kind) {
  ui.status.textContent = msg || '';
  ui.status.dataset.kind = kind || '';
}

// ---------- 主流程：生成 PDF ----------
async function generate() {
  const text = ui.input.value.trim();
  if (!text) {
    setStatus('请先输入至少一行英文句子。', 'error');
    return;
  }
  ui.generateBtn.disabled = true;
  setStatus('正在生成…', 'info');
  try {
    const [rustMod] = await Promise.all([ensureRust(), ensureTypst()]);
    showOverlay('正在生成 Typst 源码…');
    const paramsJson = JSON.stringify(collectParams());
    const source = rustMod.build_typst_source(text, paramsJson);

    showOverlay('正在编译 PDF…（句子较多时需要几秒）');
    const t0 = performance.now();
    const pdf = await window.$typst.pdf({ mainContent: source });
    const dt = ((performance.now() - t0) / 1000).toFixed(1);
    hideOverlay();

    if (!pdf || pdf.byteLength === 0) {
      throw new Error('PDF 生成结果为空');
    }
    lastPdfBytes = pdf;
    showResult(pdf);
    setStatus(`生成成功！用时 ${dt} 秒，共 ${pdf.byteLength} 字节。`, 'ok');
  } catch (err) {
    hideOverlay();
    console.error(err);
    setStatus('生成失败：' + (err && err.message ? err.message : err), 'error');
  } finally {
    ui.generateBtn.disabled = false;
  }
}

function showResult(pdfBytes) {
  // 释放旧的 blob url
  if (lastPdfBlobUrl) URL.revokeObjectURL(lastPdfBlobUrl);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  lastPdfBlobUrl = URL.createObjectURL(blob);
  ui.preview.src = lastPdfBlobUrl;
  ui.previewWrap.classList.remove('hidden');
  ui.downloadBtn.classList.remove('hidden');
  ui.downloadBtn.href = lastPdfBlobUrl;
  // 滚动到预览区
  ui.previewWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- 初始化 ----------
function init() {
  loadState();
  if (!ui.input.value) ui.input.value = SAMPLE;
  bindSliders();

  ui.generateBtn.addEventListener('click', generate);

  ui.advancedToggle.addEventListener('click', () => {
    const open = ui.advanced.classList.toggle('open');
    ui.advancedToggle.textContent = open ? '收起高级设置 ▲' : '高级设置（字号/行距/边距等） ▼';
  });

  ui.resetBtn.addEventListener('click', () => {
    if (!confirm('确定要恢复默认设置并清空输入吗？')) return;
    localStorage.removeItem(STORE_KEY);
    ui.input.value = SAMPLE;
    ui.title.value = '';
    ui.fontSize.value = 0;
    ui.lineSpacing.value = 12;
    ui.rowGap.value = 4;
    ui.blockGap.value = 28;
    ui.margin.value = 42.5;
    ui.yOffset.value = 0.5;
    ui.traceRows.value = 1;
    ui.emptyRows.value = 2;
    ui.keywordBold.checked = true;
    ui.showMarkers.checked = true;
    ui.slantEnabled.checked = false;
    ui.slantAngle.value = 12;
    ui.slantSpacing.value = 0;
    ui.theme.value = 'color';
    ui.input.dispatchEvent(new Event('input'));
    ui.fontSize.dispatchEvent(new Event('input'));
    setStatus('已恢复默认。', 'info');
  });
}

document.addEventListener('DOMContentLoaded', init);
