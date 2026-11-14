import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const OUT_DIR = path.resolve(import.meta.dirname, "../docs/images");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  console.log("Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--window-size=1440,900"],
    defaultViewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2, // Retina resolution
    },
  });

  const page = await browser.newPage();

  // Set dark theme, Russian language, and mock mode in localStorage
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("openwrt_lang", "ru");
    localStorage.setItem("openwrt_theme", "dark");
    localStorage.setItem("openwrt_mock_mode", "true");
    localStorage.setItem("openwrt_session_id", "mock_session_1234567890abcdef");
    window.addEventListener("DOMContentLoaded", () => {
      if (document.documentElement) {
        document.documentElement.classList.add("dark");
      }
    });
  });

  console.log("Navigating to router UI at http://192.168.1.1/...");
  await page.goto("http://192.168.1.1/", { waitUntil: "networkidle0" });
  await page.waitForSelector("aside", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500));

  // 1. Monochrome Overview Dashboard in Russian
  console.log("Capturing overview-ru.png...");
  await page.screenshot({ path: path.join(OUT_DIR, "overview-ru.png") });

  // 2. Overview - Connected Devices & Per-Device Routing Tab
  console.log("Clicking Connected Devices tab in Overview...");
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll("button"));
    const devTab = tabs.find((b) => b.textContent?.includes("Маршрутизация устройств") || b.textContent?.includes("Connected Devices"));
    if (devTab) devTab.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  console.log("Capturing device-routing-ru.png...");
  await page.screenshot({ path: path.join(OUT_DIR, "device-routing-ru.png") });

  // 3. Happ VPN Subscriptions via Happy Decoder API
  console.log("Navigating to Subscriptions...");
  await page.click('button[data-route="subscriptions"]');
  await new Promise((r) => setTimeout(r, 1200));
  console.log("Capturing subscriptions-happ-ru.png...");
  await page.screenshot({ path: path.join(OUT_DIR, "subscriptions-happ-ru.png") });

  // 4. Policy-Based Routing with Zapret & Per-Device
  console.log("Navigating to PBR...");
  await page.click('button[data-route="pbr"]');
  await new Promise((r) => setTimeout(r, 1000));

  // Click Trace Route button to show Zapret route result
  console.log("Tracing route for youtube.com in PBR...");
  await page.evaluate(() => {
    const traceBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Трассировать") || b.textContent?.includes("Trace")
    );
    if (traceBtn) traceBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  console.log("Capturing pbr-zapret-ru.png...");
  await page.screenshot({ path: path.join(OUT_DIR, "pbr-zapret-ru.png") });

  // 5. Zapret2 Strategy Builder
  console.log("Navigating to Zapret Builder...");
  await page.click('button[data-route="zapret"]');
  await new Promise((r) => setTimeout(r, 1000));

  // Click "Test" in Zapret builder to show live verification
  await page.evaluate(() => {
    const testBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Тест") || b.textContent?.includes("Test")
    );
    if (testBtn) testBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  console.log("Capturing zapret-strategy-ru.png...");
  await page.screenshot({ path: path.join(OUT_DIR, "zapret-strategy-ru.png") });

  // 6. VPN Manager (AWG / VLESS)
  console.log("Navigating to VPN Manager...");
  await page.click('button[data-route="vpn"]');
  await new Promise((r) => setTimeout(r, 1000));

  console.log("Capturing vpn-manager-ru.png...");
  await page.screenshot({ path: path.join(OUT_DIR, "vpn-manager-ru.png") });

  // 7. Command Palette (Cmd+K)
  console.log("Opening Command Palette...");
  await page.keyboard.down("Control");
  await page.keyboard.press("k");
  await page.keyboard.up("Control");
  await new Promise((r) => setTimeout(r, 1000));

  console.log("Capturing command-palette-ru.png...");
  await page.screenshot({ path: path.join(OUT_DIR, "command-palette-ru.png") });

  // Close palette with Escape
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 500));

  // 8. Safety Rollback Watchdog Modal
  console.log("Opening Safety Rollback Watchdog dialog...");
  await page.evaluate(() => {
    // Stage a change to trigger rollback arming
    const applyBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Сохранить и применить") || b.textContent?.includes("Apply")
    );
    if (applyBtn) applyBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  console.log("Capturing safety-rollback-ru.png...");
  await page.screenshot({ path: path.join(OUT_DIR, "safety-rollback-ru.png") });

  await browser.close();
  console.log("All screenshots captured successfully in:", OUT_DIR);
}

run().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
