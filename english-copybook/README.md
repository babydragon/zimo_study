# ✏️ 英语字帖生成器（网页版）

在浏览器里**本地**生成 A4 英语四线三格字帖 PDF，可直接打印。
对应桌面脚本版的全部功能，迁移到 **Rust + Typst + WebAssembly** 技术栈，
无需联网上传、无需后端、零构建即可部署到 Cloudflare Pages。

> 受众：小学生及其家长 / 老师。手机、平板、电脑均可使用。

---

## 功能特性

- 每行一句英文，`**word**` 标记的“核心词”在原句里**深蓝加粗**高亮
- 每句自动生成一个练习区块：
  1. 原句行（深色手写体 + 核心词高亮）
  2. 描红行（整句淡蓝，供铅笔描写）
  3. 留空行（仅四线格，供独立书写）
  4. 留空行（同上）
- 四线三格：第 3 线（基准线）珊瑚红 + 加粗，其余淡薄荷绿
- **整组不跨页**：一句话的练习区块永远不会被分页截断（由 Typst 的
  `block(breakable: false)` 保证）
- 句子过长时自动折行
- 全部参数可视化调节：字号、线距、行间隙、句子间距、页边距、基准线微调、
  描红/留空行数、配色（彩色喷墨 / 黑白激光）、核心词是否加粗、行首标记
- 输入与设置自动保存在浏览器本地（`localStorage`），下次打开自动恢复
- 纯本地运行，**不上传任何数据**

---

## 目录结构

```
english-copybook/
├── index.html              # 工具页面（入口）
├── app.js                  # 前端逻辑：参数收集、懒加载 wasm、生成流程
├── style.css               # 移动端优先的样式
├── fonts/
│   ├── EnCopybook.ttf      # 手写斜体字体（由原 EnItalic.ttf 改名而来）
│   ├── ARPLKaitiMGB.ttf    # 中文标题字体
│   └── NotoEmoji-Regular.ttf # 行首 emoji 标记字体
├── wasm/                   # Rust 核心编译产物（已构建好，随仓库提交）
│   ├── english_copybook_core.js
│   └── english_copybook_core_bg.wasm
├── vendor/                 # typst.ts 前端 JS 绑定
│   └── typst-all-in-one-lite.bundle.js   # typst.ts 的 JS 绑定（~210KB）
├── core/                   # Rust 源码（仅修改 Rust 时才需要重新构建）
│   ├── Cargo.toml
│   ├── src/lib.rs
│   ├── examples/preview.rs # 本地查看生成的 .typ 源码
│   └── pkg/                # wasm-pack 输出（被 build.sh 拷到 wasm/）
└── build.sh                # 一键重新编译脚本
```

---

## 技术栈与工作原理

```
用户输入(句子+参数)
        │
        ▼
[Rust → WASM]  core/src/lib.rs
   解析 **keyword**、校验参数、生成 Typst 源码字符串
        │
        ▼
[Typst → WASM]  jsDelivr CDN 上的 typst 编译器 wasm（typst.ts v0.7）
   把 .typ 源码编译成 PDF 字节
        │
        ▼
浏览器内 <iframe> 预览 + 下载按钮
```

- **Rust 部分**只负责“把输入变成 Typst 源码”（解析、参数校验、字符串生成），
  刻意不直接依赖 `typst` crate，编译为 wasm 更轻量、更稳。
- **Typst 部分**负责所有排版：四线格绘制、文字贴线、折行、**整组换页**。
  其中“整组不跨页”直接用了 Typst 原生的 `block(breakable: false)`，
  比桌面脚本版手工算坐标换页更简洁可靠。
- Rust 核心 wasm 会**随仓库提交**；Typst 的 28MiB 编译器 wasm 改为运行时从 CDN 拉取，
  这样可以避开 Cloudflare Pages 的 25MiB 单文件限制，同时仍保持 Pages 侧零构建。

---

## 字体处理说明

原项目使用 `fonts/EnItalic.ttf`，但该字体内部注册的字体名是 `Italic`
（一个非常通用的名字）。Typst 会按字体名查找字体，`Italic` 会和 Typst
内置的斜体字体冲突，导致字形选错。

因此在网页版中，已用 `fontTools` 把它的内部名称改为唯一的 `EnCopybook`，
另存为 `fonts/EnCopybook.ttf`。同时额外带上：

- `ARPLKaitiMGB.ttf`：用于中文标题
- `NotoEmoji-Regular.ttf`：用于行首 `🔊 / ✏` emoji

源文件 `EnItalic.ttf` 也保留在目录里以备溯源。

如需换字体，执行同样步骤：

```bash
pip install fonttools
python3 -c "
from fontTools.ttLib import TTFont
f = TTFont('你的字体.ttf')
name = f['name']
for rec in name.names:
    if rec.nameID in (1, 3, 4, 6):
        rec.string = 'EnCopybook' if rec.nameID != 6 else 'EnCopybook'
f.save('fonts/EnCopybook.ttf')
"
```

> 字体格式 **无需转换**：Typst / typst.ts 直接支持 `.ttf` / `.otf`。

---

## 重新构建 Rust 核心（仅改 Rust 时需要）

依赖：`rustup`（Rust 1.75+）和 `wasm-pack`。

```bash
# 一次性安装 wasm-pack（如果还没有）
cargo install wasm-pack

# 在 english-copybook/ 目录下
./build.sh        # 或 cd core && wasm-pack build --target web --release --out-dir pkg
```

产物会自动拷到 `wasm/`。提交 `wasm/` 即可，**部署不需要任何构建步骤**。

---

## 本地预览

任意静态服务器即可，例如：

```bash
cd english-copybook
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080/
```

> 不能用 `file://` 直接打开：浏览器的安全策略会拦截 `fetch` 本地字体/wasm。
> 部署到 Cloudflare Pages 时把仓库根目录作为输出目录即可，无需 build command。

---

## Cloudflare Pages 部署建议（推荐方案）

本仓库当前约束是：**零构建静态站点**。
所以这个小工具最合适的部署方式是：

### 推荐：本地构建好，再把产物一起提交

也就是：

1. 你本地修改 Rust 代码后运行：

```bash
cd english-copybook
./build.sh
```

2. 提交这些文件：

- `english-copybook/index.html`
- `english-copybook/app.js`
- `english-copybook/style.css`
- `english-copybook/fonts/EnCopybook.ttf`
- `english-copybook/fonts/ARPLKaitiMGB.ttf`
- `english-copybook/fonts/NotoEmoji-Regular.ttf`
- `english-copybook/vendor/typst-all-in-one-lite.bundle.js`
- `english-copybook/wasm/*`
- `english-copybook/core/src/*`（源码，便于后续维护）

3. Cloudflare Pages 配置保持：

- **Framework preset**: `None`
- **Build command**: 留空
- **Build output directory**: `/`

这样 Cloudflare 只负责托管静态文件，不参与 Rust/wasm 构建。

### 为什么要把 typst 编译器 wasm 放到 CDN

因为 Cloudflare Pages 单文件上限是 **25 MiB**，而 `typst-ts-web-compiler.wasm`
大约 **27~28 MiB**，无法直接随 Pages 一起发布。

所以当前实现改成：

- 小型前端 JS 绑定：仓库内自带
- 大型 typst 编译器 wasm：运行时从 jsDelivr 拉取

这样改动最小，部署最省事。

### 还有哪些可选方案

如果你以后不想依赖外部 CDN，还有两个方案：

1. **放到 Cloudflare R2 / 自己的对象存储**
   - 页面继续静态托管在 Pages
   - 大 wasm 从你自己的存储域名拉取
   - 这是“自己可控”的长期方案

2. **换部署平台**
   - 比如允许更大静态文件的平台
   - 但没必要，当前方案已经够简单

### 为什么不推荐让 Cloudflare Pages 直接构建

不推荐，原因：

- 这会要求在 Pages 里安装 Rust / wasm-pack
- 需要填写 build command，和当前仓库“零构建”约定冲突
- 部署链路更复杂，出问题时更难排查

### 为什么暂时也不推荐 GitHub Actions 代构建

可以做，但现在**没必要**。

适合以后再加的场景：

- 多人协作，担心忘记本地构建
- 想在 PR 里自动校验 wasm 是否最新

当前仓库更适合保持简单：

- 本地构建
- 提交产物
- Pages 直接静态发布

---

## `.gitignore` 建议

当前建议忽略：

- `english-copybook/core/target/`（Rust 编译缓存）
- `english-copybook/core/pkg/`（wasm-pack 中间产物）

但**不要忽略**：

- `english-copybook/wasm/`（最终网页实际加载的 wasm/js）
- `english-copybook/vendor/typst-all-in-one-lite.bundle.js`（typst.ts 运行时 JS）

也就是说：

- `core/pkg/` 是中间产物，不必提交
- `wasm/` 是最终部署产物，需要提交
- `vendor/typst-ts-web-compiler.wasm` 不再需要提交到 Pages

---

## 可调参数对照（与桌面脚本版一致）

| 参数 | 默认 | 说明 |
|------|------|------|
| 页眉标题 | 无 | 可选；英文/数字最稳，中文需额外中文字体 |
| 字号 | 自动（≈ 线距×2.83） | 手写体字号 pt；0=自动，更接近“满格”书写 |
| 四线格线距 | 12 pt | 相邻线间距，单格高 = 3×线距 |
| 行间隙 | 4 pt | 相邻四线格之间额外间隙 |
| 句子间距 | 28 pt | 句组区块之间间隙 |
| 页边距 | 42.5 pt（≈15mm） | |
| 基准线微调 | 0.5 pt | 字母悬空调大、下沉调小 |
| 描红行数 | 1 | 每句描红行数 |
| 留空行数 | 2 | 每句留空行数 |
| 核心词加粗 | 开 | 关闭则核心词仅用颜色区分 |
| 行首标记 | 开 | 使用 `🔊 / ✏` emoji；关闭后不再占位 |
| 带定位斜线 | 关 | 开启后在四线格上叠加淡色虚斜线，提示书写倾斜度与字母宽度 |
| 斜线角度 | 12° | 斜线相对竖直方向的倾斜角度 |
| 斜线间距 | 18 pt | 相邻斜线的水平间距 |
| 配色 | 彩色 | 彩色（喷墨）/ 黑白（激光） |

---

## 打印微调建议

1. 第一次生成后，如果小写字母底部**悬空**（与红线有缝）→ 调大「基准线微调」。
2. 如果字母**下沉**到红线以下 → 调小「基准线微调」。
3. 如果句子超出右边距 → 调小「字号」或调大「页边距」。
