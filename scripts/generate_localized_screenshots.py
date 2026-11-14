import asyncio
import json
import subprocess
import time
import urllib.request
import tempfile
import websockets
import base64
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_macos_window(content_img_path, output_path, title='ORBIX'):
    content = Image.open(content_img_path).convert('RGBA')
    w, h = content.size

    titlebar_h = 44
    shadow_margin = 30
    corner_radius = 14

    window_w = w
    window_h = h + titlebar_h

    canvas_w = window_w + shadow_margin * 2
    canvas_h = window_h + shadow_margin * 2
    canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))

    # Shadow
    shadow_mask = Image.new('L', (window_w, window_h), 0)
    sdraw = ImageDraw.Draw(shadow_mask)
    sdraw.rounded_rectangle([0, 0, window_w, window_h], radius=corner_radius, fill=160)
    shadow_img = Image.new('RGBA', (window_w, window_h), (0, 0, 0, 160))
    blurred_shadow = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    blurred_shadow.paste(shadow_img, (shadow_margin, shadow_margin + 6), shadow_mask)
    blurred_shadow = blurred_shadow.filter(ImageFilter.GaussianBlur(16))
    canvas = Image.alpha_composite(canvas, blurred_shadow)

    # Window surface
    window = Image.new('RGBA', (window_w, window_h), (24, 24, 27, 255))
    wdraw = ImageDraw.Draw(window)

    # Titlebar background
    wdraw.rectangle([0, 0, window_w, titlebar_h], fill=(24, 24, 27, 255))
    wdraw.line([(0, titlebar_h - 1), (window_w, titlebar_h - 1)], fill=(39, 39, 42, 255), width=1)

    # Traffic lights (macOS dots)
    dot_y = titlebar_h // 2
    wdraw.ellipse([18, dot_y - 6, 30, dot_y + 6], fill=(255, 95, 86), outline=(224, 68, 62))
    wdraw.ellipse([38, dot_y - 6, 50, dot_y + 6], fill=(255, 189, 46), outline=(222, 161, 35))
    wdraw.ellipse([58, dot_y - 6, 70, dot_y + 6], fill=(39, 201, 63), outline=(26, 171, 41))

    # Title text
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
    except:
        font = ImageFont.load_default()
    
    bbox = wdraw.textbbox((0, 0), title, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (window_w - tw) // 2
    ty = (titlebar_h - th) // 2
    wdraw.text((tx, ty), title, fill=(161, 161, 170), font=font)

    # Paste content below titlebar
    window.paste(content, (0, titlebar_h))

    # Outer 1px border
    wdraw.rounded_rectangle([0, 0, window_w - 1, window_h - 1], radius=corner_radius, outline=(63, 63, 70, 255), width=1)

    # Rounded corners mask for the window
    mask = Image.new('L', (window_w, window_h), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, window_w, window_h], radius=corner_radius, fill=255)

    canvas.paste(window, (shadow_margin, shadow_margin), mask)
    canvas.save(output_path, 'PNG')
    print('Generated macOS mockup:', output_path)

async def main():
    login_req = urllib.request.Request(
        'http://192.168.1.1/ubus',
        data=json.dumps({
            'jsonrpc': '2.0', 'id': 1, 'method': 'call',
            'params': ['00000000000000000000000000000000', 'session', 'login', {'username': 'root', 'password': 'root'}]
        }).encode(),
        headers={'Content-Type': 'application/json'}
    )
    resp = json.loads(urllib.request.urlopen(login_req).read().decode())
    session_id = resp['result'][1]['ubus_rpc_session']
    print(f"Logged in, session: {session_id}")

    tmp_dir = tempfile.mkdtemp(prefix='chrome_local_shots_')
    port = 9895
    proc = subprocess.Popen([
        'google-chrome', '--headless=new', '--no-sandbox', '--disable-gpu',
        f'--user-data-dir={tmp_dir}', f'--remote-debugging-port={port}',
        '--window-size=1440,900', 'about:blank'
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)

    routes = [
        ("topology", "#/traffic", "ORBIX — Топология сети (192.168.1.1)", "ORBIX — Network Topology (192.168.1.1)"),
        ("overview", "#/overview", "ORBIX — Обзор системы и телеметрия (192.168.1.1)", "ORBIX — System Overview & Telemetry (192.168.1.1)"),
        ("policies", "#/policies", "ORBIX — Управление правилами и политиками", "ORBIX — Unified Policy Engine"),
        ("catalog", "#/install", "ORBIX — Каталог оборудования и прошивок", "ORBIX — Hardware Catalog & Firmware Portal"),
    ]

    img_dir = "/home/quasar/.gemini/antigravity/scratch/openwrt-modern-panel/docs/images"
    os.makedirs(img_dir, exist_ok=True)

    try:
        tabs = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/json').read().decode())
        page_tab = next(t for t in tabs if t.get('type') == 'page')
        async with websockets.connect(page_tab['webSocketDebuggerUrl']) as ws:
            async def eval_js(code):
                cmd = {'id': 100, 'method': 'Runtime.evaluate', 'params': {'expression': code, 'returnByValue': True}}
                await ws.send(json.dumps(cmd))
                while True:
                    r = json.loads(await ws.recv())
                    if r.get('id') == 100:
                        return r.get('result', {}).get('result', {}).get('value')

            # Initial load
            await ws.send(json.dumps({'id': 1, 'method': 'Page.navigate', 'params': {'url': 'http://192.168.1.1/'}}))
            await asyncio.sleep(2.0)

            for lang in ["ru", "en"]:
                for name, route, title_ru, title_en in routes:
                    # Set localStorage and navigate
                    code = f"""
                        localStorage.setItem('openwrt_session_id', '{session_id}');
                        localStorage.setItem('openwrt_lang', '{lang}');
                        localStorage.setItem('openwrt_theme', 'dark');
                        localStorage.removeItem('orbix_topology_node_positions_v4');
                        localStorage.removeItem('orbix_topology_node_positions_v5');
                        localStorage.removeItem('orbix_topology_node_positions_v6');
                        localStorage.removeItem('orbix_topology_node_positions_v7');
                        document.documentElement.classList.add('dark');
                        location.hash = '{route}';
                        location.reload();
                    """
                    await eval_js(code)
                    # Allow React queries to settle
                    await asyncio.sleep(3.5)

                    raw_path = f"/tmp/{name}_{lang}_raw.png"
                    cmd = {'id': 50, 'method': 'Page.captureScreenshot', 'params': {'format': 'png'}}
                    await ws.send(json.dumps(cmd))
                    while True:
                        r = json.loads(await ws.recv())
                        if r.get('id') == 50:
                            data = r['result']['data']
                            with open(raw_path, 'wb') as f:
                                f.write(base64.b64decode(data))
                            break

                    title = title_ru if lang == 'ru' else title_en
                    final_path = os.path.join(img_dir, f"{name}-{lang}-macos.png")
                    cache_bust_path = os.path.join(img_dir, f"orbix-v1-{name}-{lang}.png")
                    create_macos_window(raw_path, final_path, title=title)
                    create_macos_window(raw_path, cache_bust_path, title=title)
                    if name == "topology":
                        traffic_path = os.path.join(img_dir, f"traffic-{lang}-macos.png")
                        traffic_bust_path = os.path.join(img_dir, f"orbix-v1-traffic-{lang}.png")
                        create_macos_window(raw_path, traffic_path, title=title)
                        create_macos_window(raw_path, traffic_bust_path, title=title)

    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(main())
