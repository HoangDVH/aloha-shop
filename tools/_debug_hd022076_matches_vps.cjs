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
node <<'NODE'
require("dotenv").config();
const { MongoClient } = require("mongodb");
(async () => {
  const c = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
  await c.connect();
  const db = c.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
  const rows = await db.collection("aloha_shop_orders").find({
    $or: [
      { code: "HD022076" },
      { kvInvoiceCode: "HD022076" },
      { id: "HD022076" },
      { legacyCodes: "HD022076" },
      { code: "WEB-260918-MM6V" },
    ],
  }).project({
    code:1, paymentStatus:1, orderStatus:1, kvInvoiceCode:1, kvInvoiceId:1,
    method:1, paidAt:1, confirmedBy:1, shopAccountId:1, updatedAt:1
  }).toArray();
  console.log("matches", rows.length);
  console.log(JSON.stringify(rows, null, 2));
  await c.close();
})().catch((e) => { console.error(e); process.exit(1); });
NODE
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
