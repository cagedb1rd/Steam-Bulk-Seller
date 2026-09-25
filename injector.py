# -*- coding: utf-8 -*-
"""
Steam 客户端 CDP 自动注入守护程序 (Chrome DevTools Protocol Daemon)
作用：
  1. 定时轮询 Steam 客户端开放的本地调试端口 (http://127.0.0.1:8080/json)。
  2. 智能识别当前活跃的 Steam 社区“库存”页面。
  3. 建立 WebSocket 连接并通过 CDP Runtime.evaluate 注入前端核心脚本 injected_script.js。
  4. 具备防重复注入标识感知机制，支持页面刷新后自动平滑再次注入。
"""

import os
import sys
import json
import re
import time
import asyncio
from typing import List, Dict, Any, Optional

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    import requests
    import websockets
except ImportError:
    print("[-] 缺少必要依赖库，请先执行: pip install -r requirements.txt")
    sys.exit(1)


# Steam CEF 调试默认端点
CDP_JSON_URL = "http://127.0.0.1:8080/json"
INVENTORY_URL_PATTERN = re.compile(r"steamcommunity\.com/(id|profiles)/[^/]+/inventory", re.IGNORECASE)


def get_injected_script_path() -> str:
    """
    获取 injected_script.js 绝对路径。
    兼容 PyInstaller 打包环境与源码运行环境，并支持外部脚本热修改。
    """
    # 1. 优先检查 exe/py 同级目录中的外部脚本（方便用户免重新打包直接热更）
    try:
        app_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        external_path = os.path.join(app_dir, "injected_script.js")
        if os.path.exists(external_path):
            return external_path
    except Exception:
        pass

    # 2. 检查 PyInstaller 单文件打包资源目录 (_MEIPASS)
    if hasattr(sys, "_MEIPASS"):
        bundled_path = os.path.join(sys._MEIPASS, "injected_script.js")
        if os.path.exists(bundled_path):
            return bundled_path

    # 3. 检查当前源码文件所在目录
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "injected_script.js")


def load_injected_script() -> str:
    """读取并缓存待注入的 JavaScript 源代码"""
    script_path = get_injected_script_path()
    if not os.path.exists(script_path):
        raise FileNotFoundError(f"未找到核心注入脚本文件: {script_path}")
    with open(script_path, "r", encoding="utf-8") as f:
        return f.read()


def fetch_cdp_targets() -> Optional[List[Dict[str, Any]]]:
    """
    通过 HTTP GET 获取当前 Steam CEF 进程中的所有调试目标。
    """
    try:
        resp = requests.get(CDP_JSON_URL, timeout=1.5)
        if resp.status_code == 200:
            return resp.json()
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        return None
    except Exception as e:
        # print(f"[DEBUG] 请求 CDP targets 异常: {e}")
        return None
    return None


async def evaluate_script_on_target(ws_url: str, expression: str, return_by_value: bool = True) -> Optional[Any]:
    """
    通过 WebSocket 连入指定的 Target，发送 Runtime.evaluate 评估 JavaScript 代码。
    """
    try:
        async with websockets.connect(ws_url, ping_interval=None, close_timeout=2) as ws:
            req_id = 1
            payload = {
                "id": req_id,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": expression,
                    "returnByValue": return_by_value,
                    "awaitPromise": True,
                    "userGesture": True
                }
            }
            await ws.send(json.dumps(payload))
            
            # 等待回包
            resp_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(resp_raw)
            if "result" in data and "result" in data["result"]:
                return data["result"]["result"].get("value")
            return None
    except Exception as e:
        # print(f"[DEBUG] evaluate 执行异常 ({ws_url}): {e}")
        return None


async def inject_into_page(target: Dict[str, Any], script_content: str) -> bool:
    """
    检查指定页面是否已经注入，若未注入则执行完整注入脚本。
    """
    ws_url = target.get("webSocketDebuggerUrl")
    if not ws_url:
        return False

    url = target.get("url", "")
    title = target.get("title", "未命名页面")

    # 1. 检查页面中是否已存在注入标识
    check_expr = "Boolean(window.__STEAM_BULK_SELLER_INJECTED__)"
    already_injected = await evaluate_script_on_target(ws_url, check_expr)
    
    if already_injected is True:
        # 已注入，跳过
        return False

    # 2. 注入核心脚本
    print(f"[*] 发现待注入 Steam 库存界面: [{title}]")
    print(f"[*] 页面 URL: {url}")
    print("[*] 正在通过 CDP 协议注入批量售卖前端脚本...")

    res = await evaluate_script_on_target(ws_url, script_content)
    # 注入后再次确认标识
    verify = await evaluate_script_on_target(ws_url, check_expr)
    if verify is True:
        print("=" * 65)
        print(f"[√] 成功向 Steam 客户端库存页面注入批量售卖插件！")
        print(f"[√] 当前页面: {title}")
        print("[√] 请在 Steam 客户端库存页面中查看已出现的【⚡ 批量售卖】按钮。")
        print("=" * 65)
        return True
    else:
        print("[-] 脚本评估发送完毕，但页面未能激活标识，将在下次轮询时重试。")
        return False


async def cdp_daemon_loop(poll_interval: float = 2.0):
    """
    CDP 守护进程主循环，定时扫描并执行注入。
    """
    print("=" * 65)
    print("      Steam 客户端 CDP 自动注入守护程序已启动")
    print("=" * 65)
    print(f"[+] 正在监听 Steam 调试端口: {CDP_JSON_URL}")
    print("[*] 提示: 请在 Steam 客户端内点击顶部导航【您的昵称 -> 库存】即可触发自动注入。")
    print("[*] 按 Ctrl + C 可随时退出守护进程。\n")

    port_warning_shown = False

    while True:
        targets = fetch_cdp_targets()

        if targets is None:
            if not port_warning_shown:
                print("[!] 无法连通 Steam 调试端口 8080。")
                print("    请检查:")
                print("    1. Steam 客户端是否已启动？")
                print("    2. 是否已添加 `-cef-enable-debugging` 启动参数？(可先运行 setup_steam.py)")
                print("    3. 正在等待 Steam 启动中...")
                port_warning_shown = True
            await asyncio.sleep(poll_interval)
            continue

        if port_warning_shown:
            print("[+] 成功与 Steam CEF 调试端口建立通信！开始监听页面目标...")
            port_warning_shown = False

        # 重新加载脚本内容（方便热修改与测试）
        try:
            script_content = load_injected_script()
        except Exception as e:
            print(f"[-] 读取注入脚本失败: {e}")
            await asyncio.sleep(poll_interval)
            continue

        # 筛选符合库存特征的 Page Targets
        for target in targets:
            target_type = target.get("type", "")
            target_url = target.get("url", "")

            if target_type == "page" and INVENTORY_URL_PATTERN.search(target_url):
                try:
                    await inject_into_page(target, script_content)
                except Exception as e:
                    print(f"[-] 注入流程异常: {e}")

        await asyncio.sleep(poll_interval)


def run_injector():
    """守护进程入口"""
    try:
        asyncio.run(cdp_daemon_loop(poll_interval=2.0))
    except KeyboardInterrupt:
        print("\n[*] 注入守护程序已被用户安全终止。感谢使用！")


if __name__ == "__main__":
    run_injector()
