# 教学小工具集合（Cloudflare Pages）

这个目录可以作为一个仓库根目录，里面放多个独立的静态网页小工具。

## 目录结构建议

```txt
zimo_study/
  index.html          # 导航页（入口）
  lucky/              # 抽奖工具
    index.html
    app.js
    styles.css
    sw.js
```

后续可以继续新增：

- `timer/`
- `picker/`
- `quiz/`

每个小工具都放在自己的子目录下。

## Cloudflare Pages 部署

1. 在 `zimo_study/` 初始化 git 仓库并推送到 GitHub
2. Cloudflare Pages 连接仓库
3. 使用以下配置：
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `/`

部署后访问路径示例：

- 导航页：`https://你的域名/`
- 抽奖工具：`https://你的域名/lucky/`

## 新增小工具时，是否必须让 AI 更新 index.html？

不必须。

你有三种方式：

1. **手动更新（最简单）**
   - 打开根目录 `index.html`
   - 复制一段卡片 `<a class="card" href="./xxx/">...</a>`
   - 改成新目录名

2. **让我帮你更新**
   - 每次新增一个目录后，你发我目录名，我来加导航项

3. **以后做自动导航页（可选）**
   - 需要加一个构建脚本自动扫描子目录并生成导航
   - 但会引入构建步骤，和当前“纯静态零构建”思路相比更复杂

当前推荐：先用方式 1 或 2。

## 本地预览

在根目录运行：

```bash
python -m http.server 8080
```

访问：

- `http://localhost:8080/`
- `http://localhost:8080/lucky/`
