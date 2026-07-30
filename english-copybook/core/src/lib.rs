//! 英语字帖 Typst 源码生成器
//!
//! 职责（与原 Python 脚本对应）：
//! - 解析输入文本（每行一句，支持 `**keyword**` 标记核心词）
//! - 校验并归一化所有可调参数
//! - 生成完整的 Typst 源码字符串，交给 typst.ts 在浏览器渲染为 PDF
//!
//! 不直接依赖 typst crate（编译为 wasm 更轻量、更稳）。
//! 排版、换页、折行均由 Typst 自身完成 —— 其中 `block(breakable: false)`
//! 天然实现了原脚本“整组不跨页”的要求。

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// 所有可调参数。前端以 JSON 对象传入，缺失字段使用默认值。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Params {
    /// 页眉标题（可选）。支持中文。
    pub title: Option<String>,
    /// 手写体字号 (pt)。0 表示用默认值。
    pub font_size: f64,
    /// 四线三格相邻线间距 (pt)。
    pub line_spacing: f64,
    /// 相邻四线格之间的额外间隙 (pt)，避免共用线。
    pub row_gap: f64,
    /// 句组（每个句子区块）之间的间隙 (pt)。
    pub block_gap: f64,
    /// 页边距 (pt)。约 15mm ≈ 42.5pt。
    pub margin: f64,
    /// 手写体基准线微调 (pt)。正值让文字向下贴近第 3 线。
    pub y_offset: f64,
    /// 每句的描红行数。
    pub trace_rows: u32,
    /// 每句的留空行数。
    pub empty_rows: f64,
    /// 核心词是否加粗。
    pub keyword_bold: bool,
    /// 是否在每行行首绘制 emoji 标记（🔊 / ✏）。
    pub show_markers: bool,
    /// 是否叠加“带定位”斜线（提示书写倾斜度与字母宽度）。
    pub slant_enabled: bool,
    /// 斜线倾斜角度（度，相对竖直方向）。
    pub slant_angle: f64,
    /// 相邻斜线的水平间距（pt）。
    pub slant_spacing: f64,
    /// 正文手写字体在 typst.ts 中注册的字体名。
    pub font_name: String,
    /// 配色方案：`color` 或 `bw`（黑白激光）。
    pub theme: String,
}

impl Default for Params {
    fn default() -> Self {
        Self {
            title: None,
            font_size: 0.0,
            line_spacing: 12.0,
            row_gap: 4.0,
            block_gap: 28.0,
            margin: 42.5,
            y_offset: 0.5,
            trace_rows: 1,
            // serde 将数字字段统一为 f64 简化前端传参；语义上仍是整数行数。
            empty_rows: 2.0,
            keyword_bold: true,
            show_markers: true,
            slant_enabled: false,
            slant_angle: 12.0,
            slant_spacing: 18.0,
            font_name: "EnCopybook".to_string(),
            theme: "color".to_string(),
        }
    }
}

impl Params {
    /// 把用户传入的参数收敛到安全、合理的范围。
    fn sanitized(mut self) -> Self {
        self.line_spacing = clamp(self.line_spacing, 6.0, 30.0);
        self.row_gap = clamp(self.row_gap, 0.0, 30.0);
        self.block_gap = clamp(self.block_gap, 0.0, 80.0);
        self.margin = clamp(self.margin, 10.0, 80.0);
        self.y_offset = clamp(self.y_offset, -10.0, 10.0);
        self.trace_rows = self.trace_rows.min(5);
        let er = self.empty_rows.round() as i64;
        self.empty_rows = clamp(er as f64, 0.0, 6.0);
        self.slant_angle = clamp(self.slant_angle, 0.0, 45.0);
        self.slant_spacing = clamp(self.slant_spacing, 4.0, 60.0);
        self
    }

    /// font_size == 0 表示自动，这里用一个随行距缩放的经验默认值。
    fn effective_font_size(&self) -> f64 {
        if self.font_size > 0.0 {
            clamp(self.font_size, 6.0, 60.0)
        } else {
            // 给初学书写的孩子更“满格”一些，但仍留极少量呼吸空间。
            // line_spacing=12 时约为 33pt，接近手测的 34pt。
            (self.line_spacing * 2.75).max(10.0)
        }
    }

    fn effective_empty_rows(&self) -> u32 {
        self.empty_rows.round() as u32
    }
}

fn clamp(v: f64, lo: f64, hi: f64) -> f64 {
    v.max(lo).min(hi)
}

/// 解析后的一个文本片段：是否为核心词。
#[derive(Debug, Clone)]
struct Segment {
    text: String,
    keyword: bool,
}

/// 把 `Look at my **eye**` 拆成片段序列，剥离 `**`。
fn parse_sentence(line: &str) -> Vec<Segment> {
    let mut segs = Vec::new();
    let bytes = line.as_bytes();
    let mut pos = 0;
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'*' && i + 1 < bytes.len() && bytes[i + 1] == b'*' {
            // 记录前面的普通文本
            if i > pos {
                if let Some(s) = line.get(pos..i) {
                    if !s.is_empty() {
                        segs.push(Segment { text: s.to_string(), keyword: false });
                    }
                }
            }
            // 寻找闭合 **
            if let Some(close) = find_close(line, i + 2) {
                let inner = &line[i + 2..close];
                if !inner.is_empty() {
                    segs.push(Segment { text: inner.to_string(), keyword: true });
                }
                pos = close + 2;
                i = pos;
                continue;
            } else {
                // 没有闭合，按普通文本处理
                segs.push(Segment { text: line[i..].to_string(), keyword: false });
                return segs;
            }
        }
        i += 1;
    }
    if pos < bytes.len() {
        if let Some(s) = line.get(pos..) {
            if !s.is_empty() {
                segs.push(Segment { text: s.to_string(), keyword: false });
            }
        }
    }
    segs
}

fn find_close(s: &str, start: usize) -> Option<usize> {
    let b = s.as_bytes();
    let mut i = start;
    while i + 1 < b.len() {
        if b[i] == b'*' && b[i + 1] == b'*' {
            return Some(i);
        }
        i += 1;
    }
    None
}

/// 转义 typst 字符串字面量（只用在 `#("...")` 形式里）。
fn esc_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 8);
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            _ => out.push(ch),
        }
    }
    out
}

/// 把片段序列渲染为 typst 行内 markup。
/// - 普通片段：直接 `#("...")`
/// - 核心词：`#text(fill: <color>[, weight: "bold"])[#("...")]`
fn render_inline(segs: &[Segment], kw_color: &str, bold: bool) -> String {
    let mut out = String::new();
    for seg in segs {
        if seg.keyword {
            if bold {
                out.push_str(&format!(
                    "#text(fill: {}, weight: \"bold\")[#(\"{}\")]",
                    kw_color,
                    esc_str(&seg.text)
                ));
            } else {
                out.push_str(&format!("#text(fill: {})[#(\"{}\")]", kw_color, esc_str(&seg.text)));
            }
        } else {
            out.push_str(&format!("#(\"{}\")", esc_str(&seg.text)));
        }
    }
    // 空内容兜底，避免 typst 空块报错
    if out.is_empty() {
        out.push_str("#(\"\")");
    }
    out
}

/// 描红行：所有片段都用 trace 色、不加粗。
fn render_trace_inline(segs: &[Segment], trace_color: &str) -> String {
    let flat: Vec<Segment> = segs
        .iter()
        .map(|s| Segment { text: s.text.clone(), keyword: false })
        .collect();
    // 复用 render_inline，但把 kw 色也设为 trace 色、关闭加粗，等价于整句同色。
    render_inline(&flat, trace_color, false)
}

/// 生成 Typst 文档头部（set page / colors / 行函数定义）。
fn typst_preamble(p: &Params) -> String {
    let fs = p.effective_font_size();
    let colors = color_set(&p.theme);

    format!(
        r##"#set page(
  paper: "a4",
  margin: (top: {margin}pt, bottom: {margin}pt, left: {margin}pt, right: {margin}pt),
  numbering: none,
  footer: context [
    #align(center)[#text(font: "AR PL KaitiM GB", size: 9pt, fill: rgb("#666666"))[#counter(page).display("1/1", both: true)]]
  ],
)
#set text(font: "{font}", lang: "en")
#set par(leading: 0pt, spacing: 0pt, justify: false)

#let ls = {ls}pt
#let fs = {fs}pt
#let yoff = {yoff}pt
#let rg = {rg}pt
#let bg = {bg}pt
#let padL = {padl}pt
#let contentW = {content_w}pt
#let showMarks = {show_marks}
#let showSlant = {show_slant}
#let slant-angle = {slant_angle}deg
#let slant-spacing = {slant_spacing}pt
#let emojiFont = "Noto Emoji"
#let iconFs = 14pt

#let c-line = {line_c}
#let c-base = {base_c}
#let c-normal = {normal_c}
#let c-kw = {kw_c}
#let c-trace = {trace_c}
#let c-mark-read = {mark_read}
#let c-mark-write = {mark_write}
#let c-slant = {slant_color}

// 带定位斜线：在四线格上叠加淡色虚斜线，提示书写倾斜度与字母宽度。
// 斜线从下到上向右倾斜，水平间距为 slant-spacing。
#let slant-guides(w) = {{
  let span = 3 * ls
  let dx = span * calc.tan(slant-angle)
  let i = 0
  // 用绝对的内容宽度 contentW 做循环边界，避免与相对宽度 w 混用比较报错。
  while i * slant-spacing < contentW + dx {{
    let xb = i * slant-spacing
    place(top + left, line(start: (xb, span), end: (xb + dx, 0pt),
      stroke: (paint: c-slant, thickness: 0.25pt, dash: "dashed")))
    i += 1
  }}
}}

// 单组四线三格：在高度 3*ls 的块内绝对放置 4 条横线。
// 第 3 线（基准线）= 珊瑚红、加粗；其余 = 淡薄荷绿。
// 注意：斜线不在这里画 —— 原文/描红行不画斜线，避免范例字母骑在斜线上。
#let four-lines(w) = {{
  place(top + left, line(length: w, stroke: 0.3pt + c-line))
  place(top + left, dy: ls, line(length: w, stroke: 0.3pt + c-line))
  place(top + left, dy: 2 * ls, line(length: w, stroke: 0.6pt + c-base))
  place(top + left, dy: 3 * ls, line(length: w, stroke: 0.3pt + c-line))
}}

// 行首 emoji 标记（必须在 empty-row / text-row 之前定义，供它们调用）。
// 文字与 emoji 分字体处理：
// - 正文仍用手写体
// - 标题用中文楷体
// - 行首标记用 emoji 字体
#let marker(mark, color) = place(top + left, dx: 6pt, dy: 2 * ls - 1.15 * iconFs + yoff,
  text(font: emojiFont, size: iconFs, fill: color)[#(if mark == "read" {{ "🔊" }} else {{ "✏" }})])

// 留空行：仅四线格；开启标记时画一个 ✏；开启带定位时叠加淡色斜线。
// 斜线只画在空行（独立书写行），原文/描红行不画，避免范例字母骑在斜线上。
#let empty-row(w, mark: none) = block(width: w, height: 3 * ls, spacing: 0pt)[
  #four-lines(w)
  #if showSlant {{ slant-guides(w) }}
  #if showMarks and mark == "write" {{ marker("write", c-mark-write) }}
]

// 文本行：四线格 + 贴合第 3 线的文字。
// place 的 dy 定位的是“文字框顶端”。这里把正文整体略向下放，
// 让字形更接近“满格”同时不贴到第一条线；yoff 再用于细调。
#let text-row(w, body, fill: c-normal, weight: "regular", mark: none) = block(width: w, height: 3 * ls, spacing: 0pt)[
  #four-lines(w)
  #if showMarks and mark == "read" {{ marker("read", c-mark-read) }} else if showMarks and mark == "write" {{ marker("write", c-mark-write) }}
  #place(top + left, dx: padL, dy: 2 * ls - 0.692 * fs + yoff,
    text(size: fs, fill: fill, weight: weight)[#body]
  )
]

#let trace-row(w, body) = text-row(w, body, fill: c-trace, weight: "regular", mark: "write")
#let read-row(w, body) = text-row(w, body, fill: c-normal, weight: "regular", mark: "read")

// 句组：整组不跨页（breakable: false 即原脚本的“整组换页”）。
#let group(body) = block(width: 100%, breakable: false, spacing: 0pt, body)
#let gap(h) = block(width: 100%, height: h, spacing: 0pt)[]

"##,
        margin = p.margin,
        font = p.font_name,
        ls = p.line_spacing,
        fs = fs,
        yoff = p.y_offset,
        rg = p.row_gap,
        bg = p.block_gap,
        padl = if p.show_markers { 28.0 } else { 8.0 },
        content_w = 595.28 - 2.0 * p.margin,
        show_marks = if p.show_markers { "true" } else { "false" },
        show_slant = if p.slant_enabled { "true" } else { "false" },
        slant_angle = p.slant_angle,
        slant_spacing = p.slant_spacing,
        slant_color = colors.slant,
        line_c = colors.line_other,
        base_c = colors.line_base,
        normal_c = colors.text_normal,
        kw_c = colors.text_kw,
        trace_c = colors.text_trace,
        mark_read = colors.mark_read,
        mark_write = colors.mark_write,
    )
}

struct Colors {
    line_other: &'static str,
    line_base: &'static str,
    text_normal: &'static str,
    text_kw: &'static str,
    text_trace: &'static str,
    mark_read: &'static str,
    mark_write: &'static str,
    slant: &'static str,
}

fn color_set(theme: &str) -> Colors {
    if theme == "bw" {
        Colors {
            line_other: "rgb(\"#C0C0C0\")",
            line_base: "black",
            text_normal: "black",
            text_kw: "rgb(\"#404040\")",
            text_trace: "rgb(\"#CCCCCC\")",
            mark_read: "black",
            mark_write: "rgb(\"#888888\")",
            slant: "rgb(\"#D9D9D9\")",
        }
    } else {
        Colors {
            line_other: "rgb(\"#D0EBE0\")",
            line_base: "rgb(\"#FF4D4D\")",
            text_normal: "black",
            text_kw: "rgb(\"#004D99\")",
            text_trace: "rgb(\"#9DBBD4\")",
            mark_read: "rgb(\"#004D99\")",
            mark_write: "rgb(\"#9AA7AD\")",
            slant: "rgb(\"#E3E3E3\")",
        }
    }
}

/// 解析整个输入文本，返回每个非空行解析出的片段序列。
fn parse_all(text: &str) -> Vec<Vec<Segment>> {
    text.lines()
        .map(str::trim_end)
        .filter(|l| !l.trim().is_empty())
        .map(|l| parse_sentence(l))
        .collect()
}

/// 主入口：生成 Typst 源码。
pub fn build_source(text: &str, params: Params) -> Result<String, String> {
    let p = params.sanitized();
    let sentences = parse_all(text);
    if sentences.is_empty() {
        return Err("没有有效的句子（空输入）。请在文本框里输入至少一行英文句子。".into());
    }

    let mut out = String::new();
    out.push_str(&typst_preamble(&p));

    // 页眉标题
    if let Some(title) = &p.title {
        let t = title.trim();
        if !t.is_empty() {
            out.push_str(&format!(
                "#block(width: 100%, spacing: 0pt)[#text(font: \"AR PL KaitiM GB\", size: 11pt, fill: rgb(\"#333333\"))[#(\"{}\")]]\n#gap(8pt)\n",
                esc_str(t)
            ));
        }
    }

    let trace_rows = p.trace_rows.max(0);
    let empty_rows = p.effective_empty_rows();
    let kw_color = if p.theme == "bw" { "rgb(\"#404040\")" } else { "rgb(\"#004D99\")" };
    let trace_color = if p.theme == "bw" { "rgb(\"#CCCCCC\")" } else { "rgb(\"#9DBBD4\")" };
    let bold = p.keyword_bold;

    for segs in &sentences {
        let original = render_inline(segs, kw_color, bold);
        out.push_str("#group[\n");
        out.push_str(&format!("  #read-row(100%)[{}]\n", original));
        out.push_str("  #gap(rg)\n");
        for _ in 0..trace_rows {
            let trace = render_trace_inline(segs, trace_color);
            out.push_str(&format!("  #trace-row(100%)[{}]\n", trace));
            out.push_str("  #gap(rg)\n");
        }
        for _ in 0..empty_rows {
            out.push_str("  #empty-row(100%, mark: \"write\")\n");
            if empty_rows > 0 {
                out.push_str("  #gap(rg)\n");
            }
        }
        // 去掉最后一个多余 gap（组内最后一行后不需要额外 gap，组间用 bg）。
        out.push_str("]\n");
        out.push_str("#gap(bg)\n");
    }

    Ok(out)
}

// ============================================================================
// wasm-bindgen 导出
// ============================================================================

/// 生成 Typst 源码的默认参数 JSON（供前端初始化界面用）。
#[wasm_bindgen]
pub fn default_params_json() -> String {
    serde_json::to_string_pretty(&Params::default()).unwrap_or_else(|_| "{}".to_string())
}

/// 生成 Typst 源码。
/// - text：原始输入（每行一句，支持 `**keyword**`）
/// - params_json：参数 JSON 字符串（可只包含部分字段，其余用默认值）
/// 成功返回源码字符串；失败抛出 JS Error。
#[wasm_bindgen(catch)]
pub fn build_typst_source(text: &str, params_json: &str) -> Result<String, JsValue> {
    let params: Params = if params_json.trim().is_empty() || params_json.trim() == "null" {
        Params::default()
    } else {
        serde_json::from_str::<Params>(params_json)
            .map_err(|e| JsValue::from_str(&format!("参数解析失败: {}", e)))?
    };
    build_source(text, params).map_err(|e| JsValue::from_str(&e))
}
