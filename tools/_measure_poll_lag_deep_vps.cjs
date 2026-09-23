/**
 * Phân tích sâu nginx access.log: rate/phút 15 phút gần nhất.
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
const { Client } = loadSsh2();
const keyPath = path.join(
  process.env.USERPROFILE || "",
  ".ssh",
  "id_ed25519_aloha_gha_deploy"
);

const cmd = `
set -e
node <<'NODE'
const fs = require("fs");
const { execSync } = require("child_process");
const log = "/var/log/nginx/access.log";
const raw = fs.readFileSync(log, "utf8");
const lines = raw.trim().split("\\n").slice(-30000);
const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
// Server VN = UTC+7 — nginx time is local
const now = Date.now();
const windowMs = 15 * 60 * 1000;
const keys = [
  ["prices", /\\/api\\/shop\\/products\\/prices/],
  ["catalog_sse", /\\/api\\/shop\\/catalog\\/stream/],
  ["auth_sse", /\\/api\\/shop\\/auth\\/stream/],
  ["orders_sse", /\\/api\\/shop\\/orders\\/stream/],
  ["shop_me", /\\/api\\/shop\\/(auth\\/)?me(\\?|"| |$)/],
  ["ctv_stats", /\\/api\\/shop\\/ctv\\/me\\/stats/],
  ["ctv_overview", /\\/api\\/shop\\/ctv\\/me\\/overview/],
  ["ctv_conversions", /\\/api\\/shop\\/ctv\\/me\\/conversions/],
  ["ctv_bills", /\\/api\\/shop\\/ctv\\/me\\/bills/],
  ["admin_ctv", /\\/api\\/shop\\/admin\\/ctv/],
  ["live_prices_get", /\\/api\\/shop\\/products\\/live/],
];
const byMin = {}; // minute -> key -> count
let parsed = 0, inWin = 0;
for (const line of lines) {
  const m = line.match(/\\[(\\d{2})\\/(\\w{3})\\/(\\d{4}):(\\d{2}):(\\d{2}):(\\d{2}) ([+-]\\d{4})\\]/);
  if (!m) continue;
  parsed++;
  const off = m[7]; // +0700
  const sign = off[0] === "-" ? -1 : 1;
  const oh = Number(off.slice(1,3));
  const om = Number(off.slice(3,5));
  const offsetMin = sign * (oh*60 + om);
  // Build as UTC then subtract offset to get true UTC ms of local wall time
  const utcMs = Date.UTC(+m[3], months[m[2]], +m[1], +m[4], +m[5], +m[6]) - offsetMin*60000;
  if (now - utcMs > windowMs || utcMs > now + 60000) continue;
  inWin++;
  const minute = m[4] + ":" + m[5]; // HH:MM local
  if (!byMin[minute]) byMin[minute] = {};
  for (const [name, re] of keys) {
    if (re.test(line)) byMin[minute][name] = (byMin[minute][name]||0)+1;
  }
}
const minutes = Object.keys(byMin).sort();
const totals = {};
for (const [,reName] of keys.map(k=>[k[0]])) totals[reName]=0;
for (const name of keys.map(k=>k[0])) totals[name]=0;
for (const min of minutes) {
  for (const [k,v] of Object.entries(byMin[min])) totals[k]=(totals[k]||0)+v;
}
const nMin = Math.max(minutes.length, 1);
const perMin = {};
for (const [k,v] of Object.entries(totals)) perMin[k] = Number((v/nMin).toFixed(2));

// Top minutes for prices
const priceRank = minutes.map(min => ({min, prices: byMin[min].prices||0, catalog_sse: byMin[min].catalog_sse||0, admin_ctv: byMin[min].admin_ctv||0, ctv_conversions: byMin[min].ctv_conversions||0}))
  .sort((a,b)=>b.prices-a.prices).slice(0,8);

console.log(JSON.stringify({
  serverNow: new Date().toISOString(),
  linesTail: lines.length,
  parsed,
  inLast15m: inWin,
  minutesCovered: minutes.length,
  minuteRange: minutes.length ? [minutes[0], minutes[minutes.length-1]] : [],
  totals_15m: totals,
  avg_per_minute: perMin,
  peak_minutes_by_prices: priceRank,
}, null, 2));
NODE
echo DEEP_OK
`;

const c = new Client();
c.on("ready", () => {
  c.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      c.end();
      process.exit(1);
    }
    stream.on("data", (d) => process.stdout.write(d));
    stream.stderr.on("data", (d) => process.stderr.write(d));
    stream.on("close", (code) => {
      c.end();
      process.exit(code || 0);
    });
  });
});
c.on("error", (e) => {
  console.error(e);
  process.exit(1);
});
c.connect({
  host: "160.25.167.211",
  username: "root",
  privateKey: fs.readFileSync(keyPath),
  readyTimeout: 30000,
});
