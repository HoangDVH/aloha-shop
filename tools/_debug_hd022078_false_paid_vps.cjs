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
const key = fs.readFileSync(
  path.join(process.env.USERPROFILE || "", ".ssh", "id_ed25519_aloha_gha_deploy")
);
const remoteCmd = `
set -e
cd /root/aloha-shop
node <<'NODE'
require("dotenv").config();
const { MongoClient } = require("mongodb");
(async () => {
  const c = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
  await c.connect();
  const db = c.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
  const o = await db.collection("aloha_shop_orders").findOne({
    $or: [
      { kvInvoiceCode: "HD022078" },
      { code: "WEB-260918-KAL7" },
      { code: /KAL7/i },
    ],
  });
  if (!o) { console.log("NOT_FOUND"); process.exit(0); }
  console.log(JSON.stringify({
    code: o.code,
    paymentStatus: o.paymentStatus,
    orderStatus: o.orderStatus,
    method: o.method,
    totalPayment: o.totalPayment,
    kvInvoiceId: o.kvInvoiceId,
    kvInvoiceCode: o.kvInvoiceCode,
    paidAt: o.paidAt,
    paidSource: o.paidSource,
    confirmedBy: o.confirmedBy,
    lastKvReconcileAt: o.lastKvReconcileAt,
    createdAt: o.createdAt,
    stockApplied: o.stockApplied,
    kvInvoiceMode: o.kvInvoiceMode,
  }, null, 2));
  await c.close();
})().catch((e) => { console.error(e); process.exit(1); });
NODE
pm2 logs aloha-shop-api --lines 80 --nostream 2>&1 | grep -iE 'HD022078|KAL7|kv-pay|reconcile|markPaid|Status' | tail -40 || true
`;
const c = new Client();
c.on("ready", () => {
  c.exec(remoteCmd, (err, stream) => {
    if (err) { console.error(err); c.end(); process.exit(1); }
    stream.on("data", (d) => process.stdout.write(d));
    stream.stderr.on("data", (d) => process.stderr.write(d));
    stream.on("close", (code) => { c.end(); process.exit(code || 0); });
  });
});
c.on("error", (e) => { console.error(e); process.exit(1); });
c.connect({ host: "160.25.167.211", username: "root", privateKey: key });
