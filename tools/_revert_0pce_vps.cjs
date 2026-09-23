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
const revertSrc = fs.readFileSync(
  path.join(__dirname, "_revert_false_paid_ck.cjs"),
  "utf8"
);
const remoteCmd = `
set -e
cd /root/aloha-shop
cat > /root/aloha-shop/_tmp_revert_false_paid_ck.cjs <<'ENDSCRIPT'
${revertSrc}
ENDSCRIPT
node /root/aloha-shop/_tmp_revert_false_paid_ck.cjs WEB-260918-0PCE
node -e '
require("dotenv").config();
const {MongoClient}=require("mongodb");
(async()=>{
  const c=new MongoClient(process.env.MONGO_URI||"mongodb://127.0.0.1:27017");
  await c.connect();
  const db=c.db("aloha_shop_db");
  for (const code of ["WEB-260918-KAL7","WEB-260918-0PCE"]) {
    const o=await db.collection("aloha_shop_orders").findOne({code},{projection:{code:1,paymentStatus:1,orderStatus:1,stockApplied:1,paidAt:1,kvInvoiceCode:1,expiresAt:1}});
    console.log(JSON.stringify(o));
  }
  const p=await db.collection("aloha_products").findOne({ma:"TNM2L"},{projection:{ma:1,ton:1}});
  console.log("TNM2L", JSON.stringify(p));
  await c.close();
})().catch(e=>{console.error(e);process.exit(1)});
'
rm -f /root/aloha-shop/_tmp_revert_false_paid_ck.cjs
echo OK
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
