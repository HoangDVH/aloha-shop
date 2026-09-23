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

const remoteCmd = `
set -e
cd /root/aloha-shop
echo '=== ENV ==='
grep -E 'SHOP_KV_PAY|RECONCILE' .env || echo 'no SHOP_KV_PAY keys'
echo '=== ORDER ==='
node -e '
require("dotenv").config();
const {MongoClient}=require("mongodb");
(async()=>{
  const c=new MongoClient(process.env.MONGO_URI||"mongodb://127.0.0.1:27017");
  await c.connect();
  const db=c.db(process.env.SHOP_STANDALONE_DB||"aloha_shop_db");
  const o=await db.collection("aloha_shop_orders").findOne({
    \$or:[{code:"HD022076"},{kvInvoiceCode:"HD022076"},{id:"HD022076"},{legacyCodes:"HD022076"}]
  });
  if(!o){console.log("ORDER_NOT_FOUND"); process.exit(0)}
  console.log(JSON.stringify({
    code:o.code, method:o.method, paymentStatus:o.paymentStatus, orderStatus:o.orderStatus,
    total:o.total, totalPayment:o.totalPayment,
    kvInvoiceId:o.kvInvoiceId, kvInvoiceCode:o.kvInvoiceCode,
    bankTransferContent:o.bankTransferContent,
    customerReportedPaidAt:o.customerReportedPaidAt,
    paidAt:o.paidAt, paidSource:o.paidSource, confirmedBy:o.confirmedBy,
    createdAt:o.createdAt, updatedAt:o.updatedAt
  },null,2));
  await c.close();
})().catch(e=>{console.error(e);process.exit(1)});
'
echo '=== LOGS ==='
pm2 logs aloha-shop-api --lines 100 --nostream 2>&1 | grep -iE 'kv-pay|HD022076|reconcile|markPaid|kiotqr' | tail -50 || true
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
  username: "root",
  privateKey: fs.readFileSync(keyPath),
});
