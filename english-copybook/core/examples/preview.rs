// 本地验证：直接调用 build_source 看生成的 typst 源码。
use english_copybook_core::{build_source, Params};

fn main() {
    let text = std::fs::read_to_string(
        "/mnt/data/babydragon/data/misc/zimo_study_local/english_copy_generate/w1.txt",
    )
    .unwrap();
    let src = build_source(&text, Params::default()).unwrap();
    println!("{}", src);
    std::fs::write("/tmp/opencode/preview.typ", &src).unwrap();
    println!("\n--- written to /tmp/opencode/preview.typ ---");
}
