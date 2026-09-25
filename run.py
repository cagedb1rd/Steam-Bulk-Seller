# -*- coding: utf-8 -*-
"""
Steam 客户端内嵌批量售卖工具 (Steam-Client-Injected-Bulk-Seller)
一键启动入口 (Unified Launcher)
"""

import os
import sys
import time

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import requests

from setup_steam import configure_steam_environment, is_steam_running
from injector import run_injector, CDP_JSON_URL


BANNER = r"""
========================================================================
   __ _                             ___        _ _      ___      _ _           
  / _\ |_ ___  __ _ _ __ ___       / __\_   _ | | | __ / _ \___ | | | ___ _ __ 
  \ \| __/ _ \/ _` | '_ ` _ \ ____/ /  | | | || | |/ // /_)/ _ \| | |/ _ \ '__|
  _\ \ ||  __/ (_| | | | | | |___/ /___| |_| || |   </ ___/  __/| | |  __/ |   
  \__/\__\___|\__,_|_| |_| |_|   \____/ \__,_||_|_|\_\\/    \___||_|_|\___|_|   
                                                                                
      Steam 客户端内嵌批量售卖工具 · GitHub 开源项目
      CEF 注入架构 · 天然复用登录会话 · 双向深度行情 · 避坑抢首位
========================================================================
"""


def check_port_accessible(timeout: float = 1.0) -> bool:
    """检查 Steam CEF 本地调试端口是否已就绪"""
    try:
        r = requests.get(CDP_JSON_URL, timeout=timeout)
        return r.status_code == 200
    except Exception:
        return False


def main():
    print(BANNER)

    # 1. 检测本地 8080 端口状态
    print("[*] 正在检测 Steam 客户端 CEF 远程调试端口 (127.0.0.1:8080)...")
    if not check_port_accessible():
        print("[!] 调试端口未响应，Steam 可能未启动或尚未添加 `-cef-enable-debugging` 参数。")
        print("[*] 正在启动全自动快捷方式环境配置...")
        
        # 调用 setup 配置快捷方式
        configure_steam_environment(auto_restart=False)

        print("\n[*] 正在等待 Steam 客户端启动并在 8080 端口建立监听...")
        print("[*] 提示: 请确保您已通过添加了参数的快捷方式启动了 Steam 客户端。")

        wait_count = 0
        while not check_port_accessible(timeout=1.5):
            time.sleep(2)
            wait_count += 1
            if wait_count % 5 == 0:
                print("    [...] 仍在等待 127.0.0.1:8080 端口就绪，请启动 Steam 客户端...")
            if wait_count >= 30:
                print("[-] 等待超时。请手动确认已运行 `steam.exe -cef-enable-debugging`，然后重新运行本脚本。")
                sys.exit(1)

    # 2. 端口已连通，启动注入守护程序
    print("\n[√] 成功连接至 Steam 客户端本地调试端口 (8080)！")
    print("[+] 启动 CDP 自动注入监听服务...")
    run_injector()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[*] 程序已安全退出。")
        sys.exit(0)
