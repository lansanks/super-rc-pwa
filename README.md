# PWA Demo：重生之我觉醒了超级RC系统

极简风格的两页 demo：

- 首页：大标题 + “点击进入”
- 身份选择：管理员认证 / 游客访问
- 主界面：上传按钮 + 三个栏目
  - **已有章节**：前 4 章，点击可阅读正文
  - **未更新**：第 5-10 章 + 审批通过的章节（游客灰色不可点，管理员可阅读）
  - **未审批**：本地上传的新章节
- 上传弹窗：填写章节名称、章节号，从手机选择 `.md` 文件，确认后进入“未审批”

> 注意：上传的章节只保存在当前手机浏览器的本地存储里，不同设备之间不会同步，清除浏览器数据会丢失。

## 身份认证

- **游客访问**：只能阅读“已有章节”，不能审批。
- **管理员认证**：输入密钥通过后，可阅读全部章节，并在“未审批”里审批章节；审批后该章节进入“未更新”。
- 密钥列表存放在 `admin-keys.json`，里面只有 SHA-256 哈希，没有明文密钥。

### 管理密钥（只有你能做）

```bash
cd pwa
python3 tools/manage_keys.py list                # 查看密钥
python3 tools/manage_keys.py add 新管理员        # 添加，自动生成强随机密钥
python3 tools/manage_keys.py add 我的密钥 RC-XXXX-XXXX-XXXX-XXXX  # 使用自定义密钥
python3 tools/manage_keys.py remove 默认管理员   # 删除密钥
```

> 安全说明：当前是纯静态页面、没有后端，密钥校验在浏览器里完成；`admin-keys.json` 随网站公开，所以请使用自动生成的强随机密钥（类似 `RC-XXXX-XXXX-XXXX-XXXX`），不要用生日、手机号等容易猜的密钥。需要绝对安全时，后续应接入后端认证。

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
├── admin-keys.json     # 管理员密钥哈希列表（公开文件，只有哈希）
├── chapters.json       # 章节清单（界面读取它来显示列表）
├── chapters/           # 章节正文（从项目根目录复制而来）
├── tools/
│   └── manage_keys.py  # 密钥管理脚本（只在自己电脑上运行）
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
