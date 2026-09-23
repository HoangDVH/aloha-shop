/**
 * Đo tải poll/SSE trên VPS: (1) nginx access log gần đây
 * (2) headless mở storefront đếm request 120s nếu có puppeteer.
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

function loadSsh2() {
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}

function tryPuppeteer() {
  const candidates = [
    path.join(process.cwd(), "tools/_measure_deps/package.json"),
    "C:/Users/dauvu/ALOHA-GARDEN-2/package.json",
    path.join(process.cwd(), "getPrivateTokenKV/package.json"),
    path.join(process.cwd(), "package.json"),
  ];
  for (const pkg of candidates) {
    try {
      return createRequire(pkg)("puppeteer");
    } catch {
      /* next */
    }
  }
  return null;
}

const { Client } = loadSsh2();
const keyPath =
  process.env.VPS_SSH_KEY ||
  path.join(process.env.USERPROFILE || "", ".ssh", "id_ed25519_aloha_gha_deploy");

const DURATION_SEC = Number(process.env.MEASURE_SEC || 120);
const SHOP_URL =
  process.env.SHOP_URL || "https://alohathegioichaucay.com/";

const remoteLogCmd = `
set -e
echo "=== PM2 / process ==="
pm2 jlist 2>/dev/null | node -e '
let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{
  try {
    const arr=JSON.parse(d||"[]");
    for (const p of arr) {
      if (!["aloha-shop","aloha-shop-api"].includes(p.name)) continue;
      const m=p.monit||{};
      const e=p.pm2_env||{};
      console.log(p.name+" status="+p.pm2_env.status+" restarts="+e.restart_time+" cpu="+m.cpu+"% mem_mb="+Math.round((m.memory||0)/1048576)+" uptime_s="+Math.round((Date.now()-e.pm_uptime)/1000));
    }
  } catch(e){ console.log("pm2_parse_err", e.message); }
})'

echo "=== Nginx / access log paths ==="
ls -1 /var/log/nginx/*access* 2>/dev/null | head -20 || true
ls -1 /var/log/nginx/*.log 2>/dev/null | head -20 || true

# Pick newest access log
LOG=""
for f in /var/log/nginx/access.log /var/log/nginx/aloha*.access.log /var/log/nginx/*shop*access* /var/log/nginx/*aloha*; do
  [ -f "$f" ] || continue
  LOG="$f"
done
# Prefer largest recent access
LOG=$(ls -1t /var/log/nginx/*access* 2>/dev/null | head -1 || true)
echo "USING_LOG=\${LOG:-none}"

if [ -n "\$LOG" ] && [ -f "\$LOG" ]; then
  echo "=== Last 15 minutes path hits (approx by timestamp if present) ==="
  # Count last 8000 lines (recent traffic) by path keyword
  node -e '
const fs=require("fs");
const log=process.argv[1];
const raw=fs.readFileSync(log,"utf8");
const lines=raw.trim().split(/\\n/).slice(-12000);
const keys=[
  ["/api/shop/products/prices","prices"],
  ["/api/shop/catalog/stream","catalog_sse"],
  ["/api/shop/auth/stream","auth_sse"],
  ["/api/shop/orders/stream","orders_sse"],
  ["/api/shop/me","shop_me"],
  ["/api/shop/ctv/me/stats","ctv_stats"],
  ["/api/shop/ctv/me/overview","ctv_overview"],
  ["/api/shop/ctv/me/bills","ctv_bills"],
  ["/api/shop/ctv/me/conversions","ctv_conversions"],
  ["/api/shop/admin/ctv","admin_ctv"],
];
const counts=Object.fromEntries(keys.map(([,k])=>[k,0]));
const now=Date.now();
let withTs=0, recent=0;
for (const line of lines) {
  let t=null;
  const m=line.match(/\\[(\\d{2})\\/(\\w{3})\\/(\\d{4}):(\\d{2}):(\\d{2}):(\\d{2})/);
  if (m) {
    withTs++;
    const months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    t=Date.UTC(+m[3], months[m[2]]??0, +m[1], +m[4], +m[5], +m[6]);
  }
  const inWindow=!t || (now-t)<15*60*1000;
  if (inWindow) recent++;
  if (!inWindow) continue;
  for (const [needle,key] of keys) {
    if (line.includes(needle)) counts[key]++;
  }
}
console.log(JSON.stringify({linesScanned:lines.length, withTs, recentIn15m:recent, counts},null,2));
' "\$LOG"
else
  echo "NO_ACCESS_LOG — try journalctl / pm2 logs sample"
  pm2 logs aloha-shop-api --lines 80 --nostream 2>/dev/null | tail -40 || true
fi

echo "=== Live 90s sample via tcpdump or ss (SSE connections) ==="
ss -tn state established '( sport = :3001 or sport = :3002 or dport = :443 )' 2>/dev/null | wc -l || true
echo MEASURE_LOG_OK
`;

async function measureBrowser() {
  const puppeteer = tryPuppeteer();
  if (!puppeteer) {
    console.log("\n=== Browser measure: SKIP (no puppeteer) ===");
    return null;
  }
  console.log(`\n=== Browser measure ${DURATION_SEC}s @ ${SHOP_URL} ===`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const hits = {
    prices: [],
    catalog_sse: [],
    auth_sse: [],
    orders_sse: [],
    shop_me: [],
    ctv_stats: [],
    other_api: [],
  };
  const t0 = Date.now();
  const classify = (url) => {
    const u = String(url || "");
    if (u.includes("/api/shop/products/prices")) return "prices";
    if (u.includes("/api/shop/catalog/stream")) return "catalog_sse";
    if (u.includes("/api/shop/auth/stream")) return "auth_sse";
    if (u.includes("/api/shop/orders/stream")) return "orders_sse";
    if (/\/api\/shop\/(auth\/)?me(\?|$)/.test(u)) return "shop_me";
    if (u.includes("/api/shop/ctv/me/stats")) return "ctv_stats";
    if (u.includes("/api/shop/")) return "other_api";
    return null;
  };
  page.on("request", (req) => {
    const key = classify(req.url());
    if (!key) return;
    hits[key].push(Date.now() - t0);
  });
  page.on("response", async (res) => {
    const key = classify(res.url());
    if (key === "catalog_sse" || key === "auth_sse") {
      /* SSE stays open — counted on request */
    }
  });

  await page.goto(SHOP_URL, { waitUntil: "networkidle2", timeout: 90000 });
  // Stay on homepage; also open a category-ish path if linked
  await new Promise((r) => setTimeout(r, DURATION_SEC * 1000));

  const summary = {};
  for (const [k, arr] of Object.entries(hits)) {
    const afterWarm = arr.filter((ms) => ms > 5000); // bỏ burst load đầu
    const spanMin = Math.max((DURATION_SEC - 5) / 60, 0.01);
    summary[k] = {
      total: arr.length,
      afterWarmup: afterWarm.length,
      perMin: Number((afterWarm.length / spanMin).toFixed(2)),
      times_s: afterWarm.slice(0, 20).map((ms) => Number((ms / 1000).toFixed(1))),
    };
  }
  await browser.close();
  console.log(JSON.stringify({ url: SHOP_URL, durationSec: DURATION_SEC, summary }, null, 2));
  return summary;
}

function sshExec(cmd) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    let out = "";
    c.on("ready", () => {
      c.exec(cmd, (err, stream) => {
        if (err) {
          c.end();
          reject(err);
          return;
        }
        stream.on("data", (d) => {
          const s = d.toString();
          out += s;
          process.stdout.write(s);
        });
        stream.stderr.on("data", (d) => process.stderr.write(d));
        stream.on("close", (code) => {
          c.end();
          resolve({ code: code || 0, out });
        });
      });
    });
    c.on("error", reject);
    c.connect({
      host: process.env.VPS_HOST || "160.25.167.211",
      username: process.env.VPS_USER || "root",
      privateKey: fs.readFileSync(keyPath),
      readyTimeout: 30000,
    });
  });
}

(async () => {
  console.log("=== PART A: VPS access log + PM2 ===");
  await sshExec(remoteLogCmd);
  console.log("\n=== PART B: Headless storefront (guest) ===");
  await measureBrowser();
  console.log("\nMEASURE_DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
