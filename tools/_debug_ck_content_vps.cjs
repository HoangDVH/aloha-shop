/**
 * Debug why CK content still shows HD-only on VPS.
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
echo '=== bankConfig markers ==='
grep -n 'resolveTransferContent\\|buildKiotTransferContent\\|V bill' /root/aloha-shop/backend/shopOrders/bankConfig.ts | head -20
echo
echo '=== BankTransferQrPanel markers ==='
grep -n 'resolveDisplayTransferContent\\|V bill\\|kovCode' /root/aloha-shop/frontend/components/BankTransferQrPanel.tsx | head -25
echo
echo '=== env KV payment ==='
cd /root/aloha-shop
grep -E '^(KV_|SHOP_BANK_|MONGO)' .env 2>/dev/null | sed 's/PASSWORD=.*/PASSWORD=***/;s/SECRET=.*/SECRET=***/' | head -30
echo
echo '=== inspect order HD022053 ==='
node <<'NODE'
const fs = require('fs');
const { MongoClient } = require('mongodb');
function loadEnv() {
  try {
    const t = fs.readFileSync('/root/aloha-shop/.env','utf8');
    for (const line of t.split(/\\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
    }
  } catch {}
}
(async () => {
  loadEnv();
  const uri = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.SHOP_MONGO_URL || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(uri);
  await client.connect();
  const admin = client.db().admin();
  const dbs = (await admin.listDatabases()).databases.map(d => d.name);
  for (const name of dbs) {
    if (!/aloha|shop/i.test(name)) continue;
    const db = client.db(name);
    const cols = (await db.listCollections().toArray()).map(c => c.name);
    for (const col of cols) {
      if (!/order/i.test(col)) continue;
      const o = await db.collection(col).findOne({ kvInvoiceCode: 'HD022053' });
      if (o) {
        console.log(JSON.stringify({
          db: name, col,
          code: o.code,
          paymentStatus: o.paymentStatus,
          kvInvoiceCode: o.kvInvoiceCode,
          transferContent_top: o.transferContent || null,
          kiotvietQr: o.kiotvietQr ? {
            kovCode: o.kiotvietQr.kovCode || null,
            transferContent: o.kiotvietQr.transferContent || null,
            hasQrUrl: Boolean(o.kiotvietQr.qrUrl),
            hasQrString: Boolean(o.kiotvietQr.qrString),
            amount: o.kiotvietQr.amount,
            expiresAt: o.kiotvietQr.expiresAt,
            accountNumber: o.kiotvietQr.accountNumber,
          } : null,
        }, null, 2));
      }
      const latest = await db.collection(col).find({ paymentStatus: 'unpaid', method: 'Transfer' }).sort({ createdAt: -1 }).limit(2).toArray();
      for (const x of latest) {
        console.log(JSON.stringify({
          tag: 'latest_unpaid', db: name, col,
          code: x.code, hd: x.kvInvoiceCode,
          kov: x.kiotvietQr && x.kiotvietQr.kovCode,
          tc: x.kiotvietQr && x.kiotvietQr.transferContent,
          hasQr: !!(x.kiotvietQr && x.kiotvietQr.qrUrl),
        }));
      }
    }
  }
  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
NODE
echo
echo '=== api logs (QR) ==='
pm2 logs aloha-shop-api --lines 80 --nostream 2>/dev/null | grep -iE 'bankConfig|KiotViet|kov|generate|QR|getPrivateToken' | tail -40 || true
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
  host: process.env.VPS_HOST || "160.25.167.211",
  port: Number(process.env.VPS_PORT || 22),
  username: process.env.VPS_USER || "root",
  password: process.env.VPS_PASSWORD || "aloha2026@",
});
