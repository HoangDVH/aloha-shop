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
const fixSrc = fs.readFileSync(
  path.join(__dirname, "../backend/shopOrders/kvPaymentReconcile.ts"),
  "utf8"
);
// Deploy via git is cleaner — just push then pull
const revertSrc = fs.readFileSync(
  path.join(__dirname, "_revert_false_paid_ck.cjs"),
  "utf8"
);

const remoteCmd = `
set -e
cd /root/aloha-shop
git fetch origin
git reset --hard origin/main
echo AFTER=$(git log -1 --oneline)
pm2 restart aloha-shop-api --update-env
sleep 2

# Revert false paid CK from Status=1 bug
cat > /root/aloha-shop/_tmp_revert_false_paid_ck.cjs <<'ENDSCRIPT'
${revertSrc}
ENDSCRIPT

# List recent kiotqr_reconcile paid transfers to review
node -e '
require("dotenv").config();
const {MongoClient}=require("mongodb");
(async()=>{
  const c=new MongoClient(process.env.MONGO_URI||"mongodb://127.0.0.1:27017");
  await c.connect();
  const db=c.db(process.env.SHOP_STANDALONE_DB||"aloha_shop_db");
  const since=new Date(Date.now()-6*3600e3).toISOString();
  const rows=await db.collection("aloha_shop_orders").find({
    method:"Transfer",
    paymentStatus:"paid",
    confirmedBy:"kiotqr_reconcile",
    paidAt:{$gte:since}
  }).project({code:1,kvInvoiceCode:1,paidAt:1,totalPayment:1}).toArray();
  console.log("recent_reconcile_paid", JSON.stringify(rows,null,2));
  await c.close();
})().catch(e=>{console.error(e);process.exit(1)});
'

# Revert KAL7 + any HD022078
node /root/aloha-shop/_tmp_revert_false_paid_ck.cjs WEB-260918-KAL7 HD022078

# Verify KV amounts for HD022078 after fix (should NOT mark paid)
node --import tsx <<'TS'
import "dotenv/config";
import { MongoClient } from "mongodb";
import { getKvInvoice } from "./backend/shopInvoices/kvInvoiceClient.js";
const c = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
await c.connect();
const db = c.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
for (const id of ["192656000", "HD022078"]) {
  try {
    const inv = await getKvInvoice(db, id);
    const payments = inv?.Payments || inv?.payments || [];
    console.log("KV", id, JSON.stringify({
      code: inv?.Code ?? inv?.code,
      status: inv?.Status ?? inv?.status,
      total: inv?.Total ?? inv?.total,
      totalPayment: inv?.TotalPayment ?? inv?.totalPayment,
      paymentsSum: Array.isArray(payments) ? payments.reduce((s,p)=>s+Number(p?.Amount??p?.amount??0),0) : 0,
    }));
  } catch (e) {
    console.log("KV_ERR", id, e?.message || e);
  }
}
await c.close();
TS

rm -f /root/aloha-shop/_tmp_revert_false_paid_ck.cjs
echo DEPLOY_OK
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
