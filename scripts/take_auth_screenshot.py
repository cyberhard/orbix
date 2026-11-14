import asyncio
import json
import subprocess
import time
import urllib.request
import base64
import os
import tempfile
import websockets

async def capture(url, output_path, width=1440, height=900):
    # 1. Login to ubus
    login_req = urllib.request.Request(
        'http://192.168.1.1/ubus',
        data=json.dumps({
            'jsonrpc': '2.0', 'id': 1, 'method': 'call',
            'params': ['00000000000000000000000000000000', 'session', 'login', {'username': 'root', 'password': 'root'}]
        }).encode(),
        headers={'Content-Type': 'application/json'}
    )
    login_resp = json.loads(urllib.request.urlopen(login_req).read().decode())
    session_id = login_resp['result'][1]['ubus_rpc_session']
    print(f"Logged in, session: {session_id}")

    tmp_dir = tempfile.mkdtemp(prefix="chrome_headless_")
    port = 9333
    chrome_proc = subprocess.Popen([
        "google-chrome",
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        f"--user-data-dir={tmp_dir}",
        f"--remote-debugging-port={port}",
        f"--window-size={width},{height}",
        "about:blank"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    await asyncio.sleep(1.0)

    try:
        # Get websocket debugger URL
        tabs_data = urllib.request.urlopen(f"http://127.0.0.1:{port}/json").read().decode()
        tabs = json.loads(tabs_data)
        page_tab = next(t for t in tabs if t.get("type") == "page")
        ws_url = page_tab["webSocketDebuggerUrl"]
        
        async with websockets.connect(ws_url) as ws:
            msg_id = 1
            async def send_cmd(method, params=None):
                nonlocal msg_id
                cmd = {"id": msg_id, "method": method, "params": params or {}}
                msg_id += 1
                await ws.send(json.dumps(cmd))
                while True:
                    res = json.loads(await ws.recv())
                    if res.get("id") == cmd["id"]:
                        return res.get("result")

            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")
            
            # Navigate to origin first to establish origin for localStorage
            await send_cmd("Page.navigate", {"url": "http://192.168.1.1/"})
            await asyncio.sleep(1.0)
            
            # Set localStorage
            inject_script = f"""
                localStorage.setItem('openwrt_session_id', '{session_id}');
                localStorage.setItem('openwrt_theme', 'dark');
                document.documentElement.classList.add('dark');
            """
            await send_cmd("Runtime.evaluate", {"expression": inject_script})
            
            # Navigate to target URL
            await send_cmd("Page.navigate", {"url": url})
            await asyncio.sleep(4.0) # wait for queries & render

            # Capture screenshot
            shot = await send_cmd("Page.captureScreenshot", {"format": "png"})
            img_bytes = base64.b64decode(shot['data'])
            with open(output_path, "wb") as f:
                f.write(img_bytes)
            print(f"Screenshot written to {output_path} ({len(img_bytes)} bytes)")
    finally:
        chrome_proc.terminate()
        chrome_proc.wait()
        subprocess.run(["rm", "-rf", tmp_dir])

if __name__ == "__main__":
    import sys
    url = sys.argv[1] if len(sys.argv) > 1 else "http://192.168.1.1/#/traffic"
    out = sys.argv[2] if len(sys.argv) > 2 else "/home/quasar/.gemini/antigravity/brain/6ec1e69b-3949-4cb2-8811-d247619ab544/screen_current_auth_traffic.png"
    asyncio.run(capture(url, out))
