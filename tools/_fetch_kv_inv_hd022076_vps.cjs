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

const script = `import "dotenv/config";
import { MongoClient } from "mongodb";
import { getKvInvoice } from "./backend/shopInvoices/kvInvoiceClient.js";
const c = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
await c.connect();
const db = c.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
const inv = await getKvInvoice(db, "192647737");
const payments = inv?.Payments || inv?.payments || [];
console.log(JSON.stringify({
  id: inv?.Id ?? inv?.id,
  code: inv?.Code ?? inv?.code,
  status: inv?.Status ?? inv?.status,
  total: inv?.Total ?? inv?.total,
  totalPayment: inv?.TotalPayment ?? inv?.totalPayment,
  paymentsCount: Array.isArray(payments) ? payments.length : 0,
  paymentsSum: Array.isArray(payments) ? payments.reduce((s,p)=>s+Number(p?.Amount??p?.amount??0),0) : 0,
  paidAmount: inv?.PaidAmount ?? inv?.paidAmount,
}, null, 2));
await c.close();
`;

const remoteCmd = `
set -e
cd /root/aloha-shop
cat > /root/aloha-shop/_tmp_check_kv_inv.mts <<'EOF'
${script}
EOF
node --import tsx /root/aloha-shop/_tmp_check_kv_inv.mts
rm -f /root/aloha-shop/_tmp_check_kv_inv.mts
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
