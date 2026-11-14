import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "/home/quasar/.gemini/antigravity/brain/6ec1e69b-3949-4cb2-8811-d247619ab544";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--window-size=1440,900"],
    defaultViewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
    },
  });

  const page = await browser.newPage();

  // Set dark theme and session in localStorage
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("openwrt_lang", "ru");
    localStorage.setItem("openwrt_theme", "dark");
    localStorage.setItem("openwrt_session_id", "authenticated_root_session");
    window.addEventListener("DOMContentLoaded", () => {
      if (document.documentElement) {
        document.documentElement.classList.add("dark");
      }
    });
  });

  console.log("Navigating to Captive Portal page...");
  await page.goto("http://192.168.1.1/#/captive", { waitUntil: "networkidle0", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "screen_orbix_captive_portal.png"), fullPage: false });
  console.log("Captured screen_orbix_captive_portal.png");

  console.log("Navigating to Error 402 with domain=vk.com...");
  await page.goto("http://192.168.1.1/#/errors/402?domain=vk.com", { waitUntil: "networkidle0", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "screen_orbix_error_402_domain.png"), fullPage: false });
  console.log("Captured screen_orbix_error_402_domain.png");

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
