/**
 * Force resolve QR for HD022053 via same require path as API, then print result.
 */
const { createRequire } = require("module");
const path = require("path");

function loadSsh2() {
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}
const { Client } = loadSsh2();

const remoteCmd = `
set -e
cd /root/aloha-shop
# Run with tsx like API if available
if command -v npx >/dev/null; then
  npx --yes tsx -e '
import { MongoClient } from "mongodb";
import { resolveShopPaymentQrForOrder } from "./backend/shopOrders/bankConfig.ts";
const c = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
await c.connect();
const db = c.db("aloha_shop_db");
const o = await db.collection("aloha_shop_orders").findOne({ kvInvoiceCode: "HD022053" });
if (!o) { console.log("NO_ORDER"); process.exit(0); }
console.log("order", o.code, "hadCache", !!o.kiotvietQr);
const qr = await resolveShopPaymentQrForOrder(o as any, db);
console.log(JSON.stringify({
  addInfo: qr.addInfo,
  kovCode: (qr as any).kovCode,
  qrKind: qr.qrKind,
  hasQrUrl: !!qr.qrUrl,
}, null, 2));
const o2 = await db.collection("aloha_shop_orders").findOne({ code: o.code });
console.log("saved", o2?.kiotvietQr ? { kov: o2.kiotvietQr.kovCode, tc: o2.kiotvietQr.transferContent } : null);
await c.close();
'
else
  echo "no tsx"
fi
pm2 logs aloha-shop-api --lines 30 --nostream 2>/dev/null | grep -iE "bankConfig|KiotViet|liên kết|fallback|puppeteer" | tail -20 || true
`;

const c = new Client();
c.on("ready", () => {
  c.exec(remoteCmd, (err, stream) => {
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
  port: 22,
  username: "root",
  password: process.env.VPS_PASSWORD || "aloha2026@",
});
