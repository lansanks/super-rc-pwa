#!/usr/bin/env python3
"""管理员密钥管理工具（只在自己电脑上运行，不要上传到公网共享）"""

import argparse
import hashlib
import json
import os
import secrets

KEYS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "admin-keys.json")
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 去掉易混淆的 0/O/1/I


def load_entries():
    if not os.path.exists(KEYS_FILE):
        return []
    with open(KEYS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_entries(entries):
    with open(KEYS_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
        f.write("\n")


def sha256_hex(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def generate_key():
    groups = []
    for _ in range(4):
        groups.append("".join(secrets.choice(ALPHABET) for _ in range(4)))
    return "RC-" + "-".join(groups)


def cmd_add(args):
    entries = load_entries()
    if any(e["label"] == args.label for e in entries):
        print(f"已存在同名密钥: {args.label}")
        return 1
    key = args.key if args.key else generate_key()
    entries.append({"label": args.label, "hash": sha256_hex(key)})
    save_entries(entries)
    print(f"已添加密钥: {args.label}")
    if not args.key:
        print(f"新密钥（只显示这一次，请保存好）: {key}")
    return 0


def cmd_list(_args):
    entries = load_entries()
    if not entries:
        print("当前没有密钥")
        return 0
    for e in entries:
        print(f"{e['label']}  hash:{e['hash'][:12]}...")
    return 0


def cmd_remove(args):
    entries = load_entries()
    kept = [e for e in entries if e["label"] not in args.label]
    removed = len(entries) - len(kept)
    save_entries(kept)
    print(f"已移除 {removed} 个密钥")
    return 0


def main():
    parser = argparse.ArgumentParser(description="管理 admin-keys.json")
    sub = parser.add_subparsers(dest="command", required=True)

    p_add = sub.add_parser("add", help="添加密钥")
    p_add.add_argument("label", help="密钥名称，例如: 默认管理员")
    p_add.add_argument("key", nargs="?", help="自定义密钥；不填则自动生成")
    p_add.set_defaults(func=cmd_add)

    p_list = sub.add_parser("list", help="查看密钥列表")
    p_list.set_defaults(func=cmd_list)

    p_rm = sub.add_parser("remove", help="删除密钥")
    p_rm.add_argument("label", nargs="+", help="要删除的密钥名称")
    p_rm.set_defaults(func=cmd_remove)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
