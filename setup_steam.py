# -*- coding: utf-8 -*-
"""
Steam 启动环境全自动配置脚本
作用：
  1. 定位本地 Steam 安装路径与可执行文件。
  2. 自动检索桌面与开始菜单中的 Steam 快捷方式 (.lnk)。
  3. 为快捷方式的启动参数追加 `-cef-enable-debugging`，开启 CEF 远程调试端口 (默认 8080)。
  4. 若未找到快捷方式，自动在桌面新建一个带调试参数的 Steam 快捷方式。
  5. 检测 Steam 客户端运行状态，支持一键重启使配置即时生效。
"""

import os
import sys
import subprocess
import winreg
from typing import List, Optional, Tuple

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def get_steam_install_path() -> Tuple[Optional[str], Optional[str]]:
    """
    通过 Windows 注册表定位 Steam 安装根目录及 steam.exe 完整路径。
    """
    steam_path = None
    steam_exe = None

    # 1. 尝试从当前用户注册表中读取
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam") as key:
            raw_path, _ = winreg.QueryValueEx(key, "SteamPath")
            raw_exe, _ = winreg.QueryValueEx(key, "SteamExe")
            if raw_path:
                steam_path = os.path.normpath(raw_path)
            if raw_exe:
                steam_exe = os.path.normpath(raw_exe)
    except Exception:
        pass

    # 2. 备用方式：从系统 32/64 位注册表读取
    if not steam_path:
        for reg_root in [r"SOFTWARE\WOW6432Node\Valve\Steam", r"SOFTWARE\Valve\Steam"]:
            try:
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, reg_root) as key:
                    raw_install_path, _ = winreg.QueryValueEx(key, "InstallPath")
                    if raw_install_path:
                        steam_path = os.path.normpath(raw_install_path)
                        steam_exe = os.path.join(steam_path, "steam.exe")
                        break
            except Exception:
                continue

    # 3. 常见默认路径兜底验证
    if not steam_exe or not os.path.exists(steam_exe):
        candidates = [
            r"C:\Program Files (x86)\Steam\steam.exe",
            r"C:\Program Files\Steam\steam.exe",
            r"D:\Steam\steam.exe",
            r"E:\Steam\steam.exe",
        ]
        for candidate in candidates:
            if os.path.exists(candidate):
                steam_exe = candidate
                steam_path = os.path.dirname(candidate)
                break

    return steam_path, steam_exe


def get_user_desktop_paths() -> List[str]:
    """
    获取包含普通桌面、公共桌面、OneDrive 重定向桌面的所有可能路径。
    """
    paths = []
    # 用户桌面
    user_profile = os.environ.get("USERPROFILE", "")
    if user_profile:
        paths.append(os.path.join(user_profile, "Desktop"))
        paths.append(os.path.join(user_profile, "OneDrive", "Desktop"))
    
    # 尝试从注册表精准获取 User Shell Folders
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"
        ) as key:
            desktop_val, _ = winreg.QueryValueEx(key, "Desktop")
            expanded = os.path.expandvars(desktop_val)
            if expanded not in paths:
                paths.append(expanded)
    except Exception:
        pass

    # 公共桌面
    public_dir = os.environ.get("PUBLIC", r"C:\Users\Public")
    paths.append(os.path.join(public_dir, "Desktop"))

    # 开始菜单
    app_data = os.environ.get("APPDATA", "")
    if app_data:
        paths.append(os.path.join(app_data, r"Microsoft\Windows\Start Menu\Programs"))
        paths.append(os.path.join(app_data, r"Microsoft\Windows\Start Menu\Programs\Steam"))

    program_data = os.environ.get("PROGRAMDATA", r"C:\ProgramData")
    paths.append(os.path.join(program_data, r"Microsoft\Windows\Start Menu\Programs"))
    paths.append(os.path.join(program_data, r"Microsoft\Windows\Start Menu\Programs\Steam"))

    # 去重并只保留真实存在的目录
    valid_paths = []
    for p in paths:
        norm = os.path.normpath(p)
        if os.path.isdir(norm) and norm not in valid_paths:
            valid_paths.append(norm)

    return valid_paths


def modify_shortcut_with_powershell(lnk_path: str, arg_to_add: str = "-cef-enable-debugging") -> bool:
    """
    通过 Windows 内置 PowerShell 与 WScript.Shell 接口，安全修改快捷方式参数。
    无需安装任何第三方外部二进制库。
    """
    # 转义单引号以防止注入
    safe_lnk = lnk_path.replace("'", "''")
    safe_arg = arg_to_add.replace("'", "''")

    ps_script = f"""
$ErrorActionPreference = 'Stop'
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut('{safe_lnk}')
$args = $s.Arguments
if ($args -notmatch [regex]::Escape('{safe_arg}')) {{
    if ([string]::IsNullOrWhiteSpace($args)) {{
        $s.Arguments = '{safe_arg}'
    }} else {{
        $s.Arguments = "$args {safe_arg}"
    }}
    $s.Save()
    Write-Output "UPDATED"
}} else {{
    Write-Output "ALREADY_CONFIGURED"
}}
"""
    try:
        res = subprocess.run(
            ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script],
            capture_output=True,
            text=True,
            timeout=10,
            check=True
        )
        output = res.stdout.strip()
        if "UPDATED" in output:
            print(f"[+] 成功更新快捷方式参数: {lnk_path}")
            return True
        elif "ALREADY_CONFIGURED" in output:
            print(f"[*] 快捷方式已包含调试参数，无需修改: {lnk_path}")
            return True
    except Exception as e:
        print(f"[-] 修改快捷方式失败 ({lnk_path}): {e}")
    return False


def create_steam_shortcut(desktop_path: str, steam_exe: str) -> bool:
    """
    在指定桌面目录下新建带有调试参数的 Steam 快捷方式。
    """
    target_lnk = os.path.join(desktop_path, "Steam.lnk")
    safe_lnk = target_lnk.replace("'", "''")
    safe_exe = steam_exe.replace("'", "''")

    ps_script = f"""
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut('{safe_lnk}')
$s.TargetPath = '{safe_exe}'
$s.Arguments = '-cef-enable-debugging'
$s.WorkingDirectory = [System.IO.Path]::GetDirectoryName('{safe_exe}')
$s.Description = 'Steam (已启用 CEF 调试模式)'
$s.Save()
Write-Output "CREATED"
"""
    try:
        res = subprocess.run(
            ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script],
            capture_output=True,
            text=True,
            timeout=10,
            check=True
        )
        if "CREATED" in res.stdout:
            print(f"[+] 已为您在桌面成功创建 Steam 调试快捷方式: {target_lnk}")
            return True
    except Exception as e:
        print(f"[-] 创建桌面快捷方式失败: {e}")
    return False


def is_steam_running() -> bool:
    """
    检测当前系统中是否已有 steam.exe 正在运行。
    """
    try:
        output = subprocess.check_output(
            ["tasklist", "/FI", "IMAGENAME eq steam.exe", "/NH"],
            text=True,
            stderr=subprocess.DEVNULL
        )
        return "steam.exe" in output.lower()
    except Exception:
        return False


def restart_steam(steam_exe: str):
    """
    优雅退出并重启 Steam 客户端。
    """
    print("[*] 正在向 Steam 客户端发送安全退出指令...")
    try:
        subprocess.run([steam_exe, "-shutdown"], timeout=5)
    except Exception:
        pass

    # 等待进程退出
    import time
    waited = 0
    while is_steam_running() and waited < 8:
        time.sleep(1)
        waited += 1

    if is_steam_running():
        print("[!] 客户端未响应安全退出，尝试强制结束残留进程...")
        try:
            subprocess.run(["taskkill", "/F", "/IM", "steam.exe"], capture_output=True)
            time.sleep(1)
        except Exception:
            pass

    print("[+] 正在以调试模式重新启动 Steam 客户端...")
    # 后台无阻塞启动
    subprocess.Popen([steam_exe, "-cef-enable-debugging"], creationflags=subprocess.DETACHED_PROCESS)
    print("[+] Steam 客户端已重新启动，请稍候 3~5 秒等待其完全加载。")


def configure_steam_environment(auto_restart: bool = False) -> bool:
    """
    主配置流程：定位 -> 查找快捷方式 -> 追加参数 -> 重启检测。
    """
    print("=" * 65)
    print("      Steam 客户端 - CEF 调试环境全自动配置程序")
    print("=" * 65)

    steam_path, steam_exe = get_steam_install_path()
    if not steam_exe or not os.path.exists(steam_exe):
        print("[-] 错误: 未能在本系统中检测到 Steam 安装路径，请确认 Steam 是否已安装。")
        return False

    print(f"[+] 检测到 Steam 安装目录: {steam_path}")
    print(f"[+] 检测到 Steam 可执行文件: {steam_exe}")

    search_dirs = get_user_desktop_paths()
    found_shortcuts = []

    # 扫描快捷方式
    for d in search_dirs:
        if not os.path.exists(d):
            continue
        try:
            for item in os.listdir(d):
                if item.lower().endswith(".lnk") and "steam" in item.lower():
                    found_shortcuts.append(os.path.join(d, item))
        except Exception:
            continue

    modified_count = 0
    if found_shortcuts:
        print(f"[*] 发现 {len(found_shortcuts)} 个 Steam 相关快捷方式，正在追加调试参数...")
        for lnk in found_shortcuts:
            if modify_shortcut_with_powershell(lnk, "-cef-enable-debugging"):
                modified_count += 1
    else:
        print("[!] 未在桌面或开始菜单检索到现有的 Steam 快捷方式，将自动在用户桌面生成...")
        user_desktop = os.path.join(os.environ.get("USERPROFILE", ""), "Desktop")
        if os.path.exists(user_desktop):
            if create_steam_shortcut(user_desktop, steam_exe):
                modified_count += 1

    print("-" * 65)
    print(f"[√] 快捷方式配置完成！共处理: {modified_count} 个快捷方式。")

    # 检测客户端运行状态
    if is_steam_running():
        print("[!] 检测到当前 Steam 客户端正在运行！")
        print("[!] 注意: 必须重启 Steam 客户端才能让 `-cef-enable-debugging` 参数正式生效。")
        if auto_restart:
            restart_steam(steam_exe)
        else:
            try:
                choice = input("\n[?] 是否现在由程序自动为您重启 Steam 客户端？(Y/n): ").strip().lower()
                if choice in ["", "y", "yes"]:
                    restart_steam(steam_exe)
                else:
                    print("[*] 您已选择稍后手动重启。请完全退出当前 Steam，然后通过修改后的快捷方式重新打开。")
            except (KeyboardInterrupt, EOFError):
                print("\n[*] 跳过自动重启。请手动重启 Steam 客户端。")
    else:
        print("[+] 当前 Steam 客户端未运行，请直接从配置好的桌面快捷方式启动 Steam 客户端。")

    print("=" * 65)
    return True


if __name__ == "__main__":
    configure_steam_environment(auto_restart=False)
