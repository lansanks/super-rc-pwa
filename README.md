# PWA Demo：重生之我觉醒了超级RC系统

极简风格的两页 demo：

- 首页：大标题 + “点击进入”
- 主界面：上传框（可点击，暂无逻辑）+ 底部“已有章节”列表（目前显示前 4 章）

## 本地运行

```bash
cd pwa
python3 -m http.server 8080
```

然后用手机浏览器打开 `http://你的电脑IP:8080`。

## 注意

- 真机通过局域网 IP 访问时，页面可以正常浏览；但 Service Worker（离线缓存、添加到主屏幕）只在 HTTPS 或 localhost 下生效。
- 如果要完整支持“添加到主屏幕”安装体验，之后需要把页面部署到 HTTPS 环境（如 GitHub Pages、Vercel）。

## 文件结构

```text
pwa/
├── index.html          # 两个界面
├── styles.css          # 极简样式
├── app.js              # 页面切换 + 上传按钮占位逻辑
├── chapters.json       # 章节清单（界面读取它来显示列表）
├── chapters/           # 章节正文（从项目根目录复制而来）
├── manifest.webmanifest # PWA 配置
├── sw.js               # Service Worker（离线缓存）
└── icons/              # 应用图标
```

## 下一步（预留）

- `uploadBtn` 点击事件里接章节上传逻辑
- `chapterList` 目前只显示前 4 章，后续可以做成点击章节阅读正文

## 更新章节

新章节 `.md` 文件放到 `chapters/` 目录后，重新生成章节清单：

```bash
python3 - <<'PY'
import json, os
items = [
    {"file": f"chapters/{n}", "title": n[:-3]}
    for n in sorted(os.listdir("chapters"))
    if n.endswith(".md")
]
json.dump(items, open("chapters.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)
PY
```
