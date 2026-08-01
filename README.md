# PWA Demo：重生之我觉醒了超级RC系统

极简风格的两页 demo：

- 首页：大标题 + “点击进入”
- 身份选择：管理员认证 / 游客访问
- 主界面：四个功能块（提供 idea / idea 预览 / 人物设定 / 点击上传）+ 三个栏目
  - **提供 idea**：填写姓名和 50 字以内的内容
  - **idea 预览**：查看所有 idea（云端同步），管理员可审批，通过后由灰色变为实色
  - **人物设定**：3D 全息星图——每个角色是发光光点，关系用光线连接，可拖拽旋转、点击光点查看玻璃质感详情卡（数据来自 `人物设定.md`）
  - **点击上传**：上传章节
  - **已有章节**：前 4 章，点击可阅读正文
  - **未更新**：第 5-10 章 + 审批通过的章节（游客灰色不可点，管理员可阅读）
  - **未审批**：本地上传的新章节

> 本机缓存用于离线兜底；网络恢复后会自动补同步。

## 云端同步（Supabase）

- idea、章节上传（未审批）、审批状态（未更新）都存储在 Supabase 免费项目里，跨浏览器/设备自动同步，无需任何令牌或登录操作。
- 页面使用 Supabase 的公开 anon key（设计上就是公开的），任何人都可以提交；**审批在数据库层校验管理员密钥**，只有持有有效密钥才能审批。

### 数据库初始化（一次性，在 Supabase SQL Editor 执行）

```sql
create extension if not exists pgcrypto;

create table if not exists admin_keys (
  label text primary key,
  hash text not null
);

insert into admin_keys (label, hash) values
('默认管理员', '7d7d0d17366e43db60feb11894bd1f66f1c4130a269337a2e8efa2a77e4c3d05'),
('管理员2', '51ca702ee72cda595840205e4667f98a88646dd17ce32a737d5e1528fd71b63f'),
('管理员3', '571cae7c33da4e684bf13a481b7d6538b95805a1e4a5a77d12ee82cd3b81fe29'),
('管理员4', 'da98ca8722a8b7d8f101c7439166f31a4d5f6466884d1c379f825f80bb07fe5d')
on conflict (label) do nothing;

alter table admin_keys enable row level security;
create policy "admin_keys readable" on admin_keys for select using (true);

drop policy if exists "ideas public update" on ideas;
drop policy if exists "chapters public update" on uploaded_chapters;

create policy "admin can update ideas" on ideas
for update using (
  exists (
    select 1 from admin_keys k
    where k.hash = encode(
      digest(coalesce(current_setting('request.headers', true)::json->>'x-admin-key', ''), 'sha256'),
      'hex'
    )
  )
);

create policy "admin can update chapters" on uploaded_chapters
for update using (
  exists (
    select 1 from admin_keys k
    where k.hash = encode(
      digest(coalesce(current_setting('request.headers', true)::json->>'x-admin-key', ''), 'sha256'),
      'hex'
    )
  )
);
```

### 以后新增管理员密钥

1. `python3 tools/manage_keys.py add 新名字`
2. 在小说项目根目录创建 `supabase_service_key.txt`（内容粘贴 Supabase 的 `service_role` key，只保存在本机，不要上传）
3. 运行 `python3 tools/sync_admin_keys.py`

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
├── 人物设定.md         # 人物设定（从项目根目录复制而来）
├── characters3d.js     # 3D 星图逻辑（Three.js）
├── vendor/             # 本地 Three.js 引擎文件
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
