const DEFAULT_STOCK_PER_COUPON = 2;

const STORAGE_KEYS = {
  state: "lucky_draw_state_v1",
};

const COUPONS = [
  { name: "钉钉群群表扬券", desc: "可在钉钉群获得表扬一次" },
  { name: "电话表扬券", desc: "老师给家长打表扬电话一次" },
  { name: "领读券", desc: "可当一天晨诵领读员" },
  { name: "电影券", desc: "任意一节语文课看任意电影" },
  { name: "故事券", desc: "可以请刘老师给全班讲故事1次" },
  { name: "亲子阅读券", desc: "请妈妈每天陪你阅读1小时" },
  { name: "布置作业券", desc: "作业由你布置，也可以不布置" },
  { name: "岗位券", desc: "可以任选岗位一天" },
  { name: "免值日券", desc: "可免去一次值日" },
  { name: "缤纷课间领操券", desc: "课间操站最前面领操" },
  { name: "午餐打饭券", desc: "可参与午餐打饭一天" },
  { name: "带队一天券", desc: "可当一天路队长" },
  { name: "玩游戏券", desc: "请刘老师陪你玩游戏1次" },
  { name: "零食券", desc: "请家长给你买你想要的零食1份" },
  { name: "限时同桌一天券", desc: "可自选同桌坐一天" },
  { name: "优先批改作业券", desc: "可获得老师优先批改作业1天" },
  { name: "任意购书券", desc: "请刘老师给你买任意一本书" },
  { name: "陪读券", desc: "请刘老师陪你阅读1小时" },
  { name: "家访券", desc: "请刘老师去家访一次" },
  { name: "摄影师券", desc: "可给同学拍照10分钟" },
  { name: "合影券", desc: "和刘老师合影一次并打印张贴" },
  { name: "美食券", desc: "刘老师给你买你想吃的美食1份" },
  { name: "与老师共进午餐券", desc: "可与老师共进午餐一天" },
  { name: "万能券", desc: "可兑换任意奖励券一张" },
  { name: "试题剧透券", desc: "可获得平时小测提前剧透1次" },
  { name: "好友加分券", desc: "给好朋友加1颗磁力小红花" },
  { name: "夸夸券", desc: "刘老师连续为你写夸夸卡2天" },
  { name: "小尾巴券", desc: "时时刻刻跟着刘老师1天" },
  { name: "提问转移券", desc: "被提问时转移给班级任意同学" },
  { name: "讲故事插队券", desc: "可以插队讲故事" },
  { name: "荣誉墙券", desc: "照片上荣誉墙1周" },
  { name: "朋友圈券", desc: "请刘老师在朋友圈夸夸你" },
  { name: "组长券", desc: "可当小组长一天" },
  { name: "加星券", desc: "请可以给好朋友加5颗星" },
  { name: "展示券", desc: "可以在全班展示任意项目" },
  { name: "陪伴券（老师）", desc: "请刘老师一整天都陪你" },
  { name: "陪伴券（家长）", desc: "请爸爸妈妈周末两天都陪你" },
  { name: "日记王券", desc: "可以连得三天日记王" },
  { name: "读书翻倍券", desc: "读书时间加星翻倍" },
  { name: "奖状券", desc: "获得精美奖状一份" },
  { name: "代班班长券", desc: "可以当一天代班班长" },
  { name: "提前下课券", desc: "请老师提前5分钟下课" },
  { name: "博物馆券", desc: "请刘老师陪你逛博物馆1次" },
  { name: "KFC券", desc: "请妈妈带你去肯德基饱餐一顿" },
  { name: "露营券", desc: "请爸爸妈妈陪你去露营一次" },
  { name: "电脑桌面券", desc: "请老师用你的照片作为桌面一周" },
  { name: "听歌券", desc: "选择一首喜欢的歌在下课播放" },
  { name: "批日记券", desc: "和老师一起批日记，由你加星" },
  { name: "免作业券", desc: "今晚可以不写任何作业" },
  { name: "看电影券", desc: "可以请刘老师陪你看电影" },
  { name: "邀请券", desc: "邀请任何一名同学去做客" },
  { name: "零花钱券", desc: "请家长给你零花钱5元" },
  { name: "生日券", desc: "请刘老师给你买生日蛋糕" },
  { name: "加倍券", desc: "任何奖励都可以加一倍" },
  { name: "文具券", desc: "请家长给你买你想要的文具" },
  { name: "书籍券", desc: "请家长给你买你想要的书籍" },
  { name: "互换身份券", desc: "可以和爸爸妈妈互换身份1天" },
  { name: "鸡米花券", desc: "请家长给你买鸡米花1份" },
  { name: "加时长券", desc: "可以玩平板加长10分钟" },
  { name: "拒绝券（家长）", desc: "可以拒绝爸爸妈妈的要求1次" },
  { name: "拒绝券（老师）", desc: "可以拒绝刘老师的要求1次" },
  { name: "野餐券", desc: "请刘老师陪你野餐1次" },
  { name: "班级夸夸券", desc: "请刘老师在班级夸你1次" },
  { name: "抵扣券", desc: "可以抵扣扣掉的小星星3颗" },
  { name: "买乐高券", desc: "请家长给你买乐高积木" },
  { name: "玩具券", desc: "请家长给你买玩具1种" },
  { name: "提问券", desc: "可以任意向老师提问，必须回答" },
  { name: "搭乐高券", desc: "可以请家长陪你搭乐高1小时" },
  { name: "家访夸夸券", desc: "可以请刘老师家访，全程表扬。" },
  { name: "购物券", desc: "可以请家长陪你疯狂购物1次" },
  { name: "免家务券", desc: "可以请家长免去家务劳动1次" },
  { name: "烹饪券", desc: "可以请家长陪你烹饪1次" },
  { name: "双次零食券", desc: "可以请家长给你买零食2次" },
  { name: "双次游戏券", desc: "可以请家长陪你玩游戏2次" },
  { name: "双次万能券", desc: "可以满足任意两种奖励形式" },
].map((coupon, index) => ({ ...coupon, id: `coupon-${index + 1}` }));

const els = {
  stageLabel: document.getElementById("stageLabel"),
  studentId: document.getElementById("studentId"),
  studentStatus: document.getElementById("studentStatus"),
  numpad: document.getElementById("numpad"),
  rollingDisplay: document.getElementById("rollingDisplay"),
  drawActionWrap: document.getElementById("drawActionWrap"),
  drawButton: document.getElementById("drawButton"),
  postDrawActions: document.getElementById("postDrawActions"),
  redrawButton: document.getElementById("redrawButton"),
  nextStudentButton: document.getElementById("nextStudentButton"),
  editStudentIdButton: document.getElementById("editStudentIdButton"),
  resultCard: document.getElementById("resultCard"),
  winnerName: document.getElementById("winnerName"),
  winnerPrize: document.getElementById("winnerPrize"),
  winnerTime: document.getElementById("winnerTime"),
  couponGrid: document.getElementById("couponGrid"),
  recordTableBody: document.getElementById("recordTableBody"),
  exportButton: document.getElementById("exportButton"),
  resetButton: document.getElementById("resetButton"),
  couponToggle: document.getElementById("couponToggle"),
};

let state = loadState();
let isDrawing = false;
let couponsExpanded = false;
let confirmedStudentId = "";
let drawCompleted = false;

renderAll();
registerServiceWorker();

els.drawButton.addEventListener("click", onDrawClick);
els.redrawButton.addEventListener("click", onRedrawClick);
els.nextStudentButton.addEventListener("click", onNextStudentClick);
els.exportButton.addEventListener("click", onExportCsvClick);
els.resetButton.addEventListener("click", onResetClick);
els.couponToggle.addEventListener("click", onCouponToggleClick);
els.editStudentIdButton.addEventListener("click", onEditStudentIdClick);

if (els.numpad) {
  els.numpad.addEventListener("click", onNumpadClick);
}

function loadState() {
  const initial = {
    round: 0,
    stockPerCoupon: DEFAULT_STOCK_PER_COUPON,
    inventory: Object.fromEntries(COUPONS.map((coupon) => [coupon.id, DEFAULT_STOCK_PER_COUPON])),
    records: [],
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.state);
    if (!raw) {
      return initial;
    }

    const parsed = JSON.parse(raw);
    const stockPerCoupon = Number.isInteger(parsed.stockPerCoupon) ? parsed.stockPerCoupon : DEFAULT_STOCK_PER_COUPON;
    const inventory = {};

    for (const coupon of COUPONS) {
      const v = parsed.inventory?.[coupon.id];
      inventory[coupon.id] = Number.isInteger(v) && v >= 0 ? v : stockPerCoupon;
    }

    const records = Array.isArray(parsed.records)
      ? parsed.records.map((r) => ({
          ...r,
          studentId: normalizeStudentId(r.studentId ?? r.studentName ?? ""),
        }))
      : [];

    return {
      round: Number.isInteger(parsed.round) ? parsed.round : records.length,
      stockPerCoupon,
      inventory,
      records,
    };
  } catch {
    return initial;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(state));
}

function renderAll() {
  renderInventory();
  renderRecords();
  updateDrawButtonStatus();
  updateStudentStepUi();
}

function renderInventory() {
  const itemsHtml = COUPONS.map((coupon) => {
    const remain = state.inventory[coupon.id] ?? 0;
    const emptyClass = remain <= 0 ? "empty" : "";
    return `
      <article class="coupon-item ${emptyClass}">
        <h3>${escapeHtml(coupon.name)}</h3>
        <p>${escapeHtml(coupon.desc)}</p>
        <p class="meta">剩余：${remain} / ${state.stockPerCoupon}</p>
      </article>
    `;
  }).join("");

  els.couponGrid.innerHTML = itemsHtml;
}

function renderRecords() {
  const rows = state.records
    .slice()
    .reverse()
    .map(
      (record) => `
      <tr>
        <td>${record.round}</td>
        <td>${escapeHtml(record.timeText)}</td>
        <td>${escapeHtml(record.studentId)}</td>
        <td>${escapeHtml(record.couponName)}</td>
      </tr>
    `,
    )
    .join("");

  els.recordTableBody.innerHTML = rows || '<tr><td colspan="4" class="meta">暂无记录</td></tr>';
}

function updateDrawButtonStatus() {
  const hasAnyStock = getAvailableCoupons().length > 0;
  const canDraw = Boolean(confirmedStudentId);
  els.drawButton.disabled = !hasAnyStock || isDrawing || !canDraw;

  if (!hasAnyStock) {
    els.rollingDisplay.textContent = "券已全部抽完，请重置或增加数量";
  }
}

function getAvailableCoupons() {
  return COUPONS.filter((coupon) => (state.inventory[coupon.id] ?? 0) > 0);
}

async function onDrawClick() {
  if (isDrawing) {
    return;
  }

  if (!confirmedStudentId) {
    alert("请先输入学号并点击确定");
    return;
  }

  const pool = getAvailableCoupons();
  if (pool.length === 0) {
    alert("所有券都抽完啦");
    return;
  }

  isDrawing = true;
  updateDrawButtonStatus();
  els.resultCard.classList.add("hidden");

  const selected = await playRollingAnimation(pool);

  state.inventory[selected.id] -= 1;
  state.round += 1;

  const now = new Date();
  const record = {
    round: state.round,
    timestamp: now.toISOString(),
    timeText: now.toLocaleString("zh-CN", { hour12: false }),
    studentId: confirmedStudentId,
    couponId: selected.id,
    couponName: selected.name,
    couponDesc: selected.desc,
  };

  state.records.push(record);
  saveState();

  els.winnerName.textContent = `学号：${record.studentId}`;
  els.winnerPrize.textContent = `${record.couponName}`;
  els.winnerTime.textContent = `${record.timeText}`;
  els.resultCard.classList.remove("hidden");
  els.rollingDisplay.textContent = `🎉 ${record.couponName}`;

  isDrawing = false;
  drawCompleted = true;
  renderAll();
}

function onRedrawClick() {
  if (!confirmedStudentId || isDrawing) {
    return;
  }
  onDrawClick();
}

function onNextStudentClick() {
  if (isDrawing) {
    return;
  }
  clearStudentIdAfterDraw();
  drawCompleted = false;
  els.resultCard.classList.add("hidden");
  els.rollingDisplay.textContent = "准备抽奖";
  renderAll();
}

function playRollingAnimation(pool) {
  return new Promise((resolve) => {
    const durationMs = 2400;
    const intervalMs = 85;
    const endTime = Date.now() + durationMs;

    const timer = setInterval(() => {
      const randomCoupon = pool[Math.floor(Math.random() * pool.length)];
      els.rollingDisplay.textContent = `🎲 ${randomCoupon.name}`;

      if (Date.now() >= endTime) {
        clearInterval(timer);
        const finalCoupon = weightedRandomCoupon(pool);
        resolve(finalCoupon);
      }
    }, intervalMs);
  });
}

function weightedRandomCoupon(pool) {
  const expanded = [];
  for (const coupon of pool) {
    const count = state.inventory[coupon.id] ?? 0;
    for (let i = 0; i < count; i += 1) {
      expanded.push(coupon);
    }
  }
  return expanded[Math.floor(Math.random() * expanded.length)];
}

function onExportCsvClick() {
  if (state.records.length === 0) {
    alert("暂无记录可导出");
    return;
  }

  const header = ["轮次", "时间", "学号", "奖品", "说明"];
  const lines = [header, ...state.records.map((r) => [r.round, r.timeText, r.studentId, r.couponName, r.couponDesc])];

  const csv = lines.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `抽奖记录_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

function onResetClick() {
  const ok = window.confirm("确认重置吗？将清空库存和抽奖记录。");
  if (!ok) {
    return;
  }

  state = {
    round: 0,
    stockPerCoupon: DEFAULT_STOCK_PER_COUPON,
    inventory: Object.fromEntries(COUPONS.map((coupon) => [coupon.id, DEFAULT_STOCK_PER_COUPON])),
    records: [],
  };

  saveState();
  drawCompleted = false;
  clearStudentIdAfterDraw();
  els.resultCard.classList.add("hidden");
  els.rollingDisplay.textContent = "准备抽奖";
  renderAll();
}

function onCouponToggleClick() {
  couponsExpanded = !couponsExpanded;
  els.couponGrid.classList.toggle("expanded", couponsExpanded);
  els.couponGrid.classList.toggle("collapsed", !couponsExpanded);
  els.couponToggle.textContent = couponsExpanded ? "收起券列表" : "展开全部券";
}

function onNumpadClick(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const key = button.dataset.key;
  const action = button.dataset.action;

  if (key) {
    if (els.studentId.value.length >= 6) {
      return;
    }
    els.studentId.value += key;
    return;
  }

  if (action === "clear") {
    els.studentId.value = "";
    confirmedStudentId = "";
    updateStudentStepUi();
    updateDrawButtonStatus();
    return;
  }

  if (action === "delete") {
    els.studentId.value = els.studentId.value.slice(0, -1);
    if (!els.studentId.value) {
      confirmedStudentId = "";
      updateStudentStepUi();
      updateDrawButtonStatus();
    }
    return;
  }

  if (action === "confirm") {
    const normalized = normalizeStudentId(els.studentId.value);
    if (normalized === "未填") {
      alert("请先输入学号");
      return;
    }
    confirmedStudentId = normalized;
    els.studentId.value = confirmedStudentId;
    updateStudentStepUi();
    updateDrawButtonStatus();
    els.drawButton.focus();
  }
}

function onEditStudentIdClick() {
  confirmedStudentId = "";
  drawCompleted = false;
  els.studentId.value = "";
  updateStudentStepUi();
  updateDrawButtonStatus();
}

function updateStudentStepUi() {
  const confirmed = Boolean(confirmedStudentId);

  if (confirmed) {
    if (drawCompleted) {
      els.stageLabel.textContent = "第三步：继续抽奖或切换下一位";
      els.studentStatus.textContent = `当前学号：${confirmedStudentId}（可再抽一次，或点“下一位”）`;
    } else {
      els.stageLabel.textContent = "第二步：点击开始抽奖";
      els.studentStatus.textContent = `当前学号：${confirmedStudentId}（准备抽奖）`;
    }

    const showPrimaryDraw = !drawCompleted;
    els.drawActionWrap.classList.toggle("hidden", !showPrimaryDraw);
    els.postDrawActions.classList.toggle("hidden", showPrimaryDraw);
    els.editStudentIdButton.classList.toggle("hidden", drawCompleted);
    els.numpad.classList.add("hidden");
  } else {
    els.stageLabel.textContent = "第一步：输入学号并确认";
    els.studentStatus.textContent = "请先输入学号，再点键盘“确定”";
    els.drawActionWrap.classList.add("hidden");
    els.postDrawActions.classList.add("hidden");
    els.editStudentIdButton.classList.add("hidden");
    els.numpad.classList.remove("hidden");
  }
}

function clearStudentIdAfterDraw() {
  confirmedStudentId = "";
  els.studentId.value = "";
}

function normalizeStudentId(raw) {
  const clean = String(raw ?? "").replace(/\D+/g, "").slice(0, 6);
  return clean || "未填";
}

function escapeCsvCell(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.register("./sw.js").catch(() => {
    // SW 注册失败时保持静默，不影响页面使用。
  });
}

window.LUCKY_CONFIG = {
  DEFAULT_STOCK_PER_COUPON,
  COUPON_COUNT: COUPONS.length,
};
