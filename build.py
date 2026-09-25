# -*- coding: utf-8 -*-
"""
Steam 客户端内嵌批量售卖工具 - 一键打包为独立 EXE 可执行文件脚本
使用方法：
    python build.py
打包产物将自动输出至 dist/SteamBulkSeller.exe
"""

import os
import sys
import subprocess
import shutil

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def build_exe():
    print("=" * 65)
    print("      正在打包 SteamBulkSeller 为单文件绿色版 EXE...")
    print("=" * 65)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    js_file = os.path.join(base_dir, "injected_script.js")
    entry_file = os.path.join(base_dir, "run.py")

    if not os.path.exists(js_file):
        print(f"[-] 错误: 未找到必要资源文件: {js_file}")
        sys.exit(1)

    # 构造 PyInstaller 参数
    # Windows 环境下资源添加格式为：<源文件路径>;<打包后相对目录>
    add_data_arg = f"{js_file};."

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--onefile",
        "--clean",
        "--noconfirm",
        "--name",
        "SteamBulkSeller",
        "--add-data",
        add_data_arg,
        entry_file
    ]

    print(f"[*] 执行命令: {' '.join(cmd)}\n")

    res = subprocess.run(cmd, cwd=base_dir)
    if res.returncode != 0:
        print("\n[-] 打包失败，请检查上方控制台报错。")
        sys.exit(res.returncode)

    dist_exe = os.path.join(base_dir, "dist", "SteamBulkSeller.exe")
    if os.path.exists(dist_exe):
        size_mb = os.path.getsize(dist_exe) / (1024 * 1024)
        print("\n" + "=" * 65)
        print("[√] 打包成功！")
        print(f"[√] 生成文件: {dist_exe}")
        print(f"[√] 文件大小: {size_mb:.2f} MB")
        print("[+] 该 EXE 为绿色便携版，已内置全部运行时依赖与前端注入脚本。")
        print("    普通用户无需安装 Python，直接双击运行即可！")
        print("=" * 65)
    else:
        print("\n[-] 未在 dist 目录检索到目标可执行文件。")


if __name__ == "__main__":
    build_exe()
