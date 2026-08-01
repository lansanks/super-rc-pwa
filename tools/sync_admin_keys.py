#!/usr/bin/env python3
"""把 admin-keys.json 里的管理员密钥哈希同步到 Supabase admin_keys 表"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
KEYS_FILE = os.path.join(BASE, "..", "admin-keys.json")
# 服务密钥文件放在小说项目根目录（pwa 仓库外面），只保存在本机
SERVICE_KEY_FILE = os.path.join(BASE, "..", "..", "supabase_service_key.txt")
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://dmsogohfssgoewfitzqi.supabase.co"
)


def main():
    if not os.path.exists(SERVICE_KEY_FILE):
        print(
            "缺少服务密钥文件：请在小说项目根目录创建 supabase_service_key.txt，"
            "内容粘贴 Supabase 的 service_role key"
        )
        return 1

    with open(SERVICE_KEY_FILE, "r", encoding="utf-8") as f:
        service_key = f.read().strip()
    if not service_key:
        print("supabase_service_key.txt 是空的")
        return 1

    with open(KEYS_FILE, "r", encoding="utf-8") as f:
        keys = json.load(f)

    rows = [{"label": k["label"], "hash": k["hash"]} for k in keys]
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/admin_keys",
        data=json.dumps(rows).encode("utf-8"),
        method="POST",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )

    try:
        urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as exc:
        print(f"同步失败: {exc.code} {exc.read().decode('utf-8', 'ignore')[:200]}")
        return 1

    print(f"已同步 {len(rows)} 个管理员密钥到 Supabase")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
