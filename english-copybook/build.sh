#!/usr/bin/env bash
# 重新编译 Rust 核心为 WebAssembly，并把产物拷到 wasm/ 供网页使用。
# 仅在修改了 core/src/ 下的 Rust 代码后才需要执行。
#
# 依赖：rustup（rust 1.75+）、wasm-pack
#   安装 wasm-pack： cargo install wasm-pack
set -euo pipefail

cd "$(dirname "$0")"

echo "[1/2] 编译 Rust -> wasm（release，含 LTO，约 1~2 分钟）…"
wasm-pack build --target web --release --out-dir pkg core

echo "[2/2] 拷贝产物到 wasm/ …"
mkdir -p wasm
cp core/pkg/english_copybook_core.js      wasm/
cp core/pkg/english_copybook_core_bg.wasm wasm/

echo "完成。产物："
ls -la wasm/
