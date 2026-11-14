import puppeteer from "puppeteer-core";

async function run() {
  const res = await fetch("http://192.168.1.1/ubus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "call",
      params: ["00000000000000000000000000000000", "session", "login", { username: "root", password: "root" }]
    })
  });
  const data = await res.json();
  const sessionId = data.result?.[1]?.ubus_rpc_session;
  console.log("Obtained live ubus session:", sessionId);

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  const errors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    errors.push({ type: "pageerror", text: err.message });
  });

  await page.evaluateOnNewDocument((token) => {
    localStorage.setItem("openwrt_session_id", token);
    localStorage.setItem("openwrt_lang", "ru");
    localStorage.setItem("openwrt_theme", "dark");
  }, sessionId);

  const routes = [
    "",
    "#/overview",
    "#/traffic",
    "#/explain",
    "#/policies",
    "#/lists",
    "#/dns",
    "#/bandwidth",
    "#/clients",
    "#/logs",
    "#/vpn",
    "#/subscriptions",
    "#/zapret",
    "#/podkop",
    "#/pbr",
    "#/interfaces",
    "#/wireless",
    "#/dhcp",
    "#/firewall",
    "#/diagnostics",
    "#/general",
    "#/admin",
    "#/software",
    "#/services",
    "#/tasks",
    "#/backup",
    "#/install"
  ];

  for (const r of routes) {
    console.log(`Checking http://192.168.1.1/${r}...`);
    await page.goto(`http://192.168.1.1/${r}`, { waitUntil: "networkidle0", timeout: 8000 }).catch(() => {});
    await new Promise((res) => setTimeout(res, 500));
  }

  console.log("=== LOGGED ERRORS ===");
  console.log(JSON.stringify(errors, null, 2));

  await browser.close();
}

run().catch(console.error);
