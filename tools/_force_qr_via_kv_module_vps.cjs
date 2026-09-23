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

const remoteCmd = `cd /root/aloha-shop && node <<'NODE'
const fs = require('fs');
const { MongoClient } = require('mongodb');
function loadEnv(p){
  try{
    for (const line of fs.readFileSync(p,'utf8').split(/\\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
    }
  } catch {}
}
loadEnv('/root/aloha-shop/.env');
(async () => {
  process.chdir('/root/aloha-shop');
  const kv = require('/root/aloha-shop/getPrivateTokenKV');
  const client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('aloha_shop_db');
  const o = await db.collection('aloha_shop_orders').findOne({ kvInvoiceCode: 'HD022053' });
  if (!o) { console.log('NO_ORDER'); process.exit(0); }
  const amount = Number(o.totalPayment ?? o.total) || 0;
  const hd = String(o.kvInvoiceCode || '');
  const paymentId = process.env.KV_PAYMENT_ID || '9931101233';
  console.log('generating for', o.code, amount, hd);
  const kvRes = await kv.generateKiotVietPaymentQr({
    amount,
    content: 'bill ' + hd,
    paymentId,
    paymentCode: process.env.KV_PAYMENT_CODE || 'VCB',
  });
  const body = kvRes.body || kvRes;
  const kovCode = String(body.kov_code || '').trim();
  const transferContent = kovCode
    ? (/\\bV$/i.test(kovCode) ? (kovCode + ' bill ' + hd) : (kovCode + ' V bill ' + hd))
    : ('bill ' + hd);
  const kiotvietQr = {
    kovCode,
    qrUrl: String(body.image || ''),
    qrString: String(body.qr_string || ''),
    transferContent,
    amount,
    accountNumber: paymentId,
    expiresAt: new Date(Date.now() + 14 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };
  await db.collection('aloha_shop_orders').updateOne({ _id: o._id }, { $set: { kiotvietQr } });
  console.log(JSON.stringify({ transferContent, kovCode, hasQrUrl: !!kiotvietQr.qrUrl }, null, 2));
  if (body.transaction_id && o.kvInvoiceId && typeof kv.saveDynamicPaymentCode === 'function') {
    try {
      await kv.saveDynamicPaymentCode({
        transactionId: body.transaction_id,
        kovCode,
        documentId: o.kvInvoiceId,
        invoiceCode: hd,
        amount,
        description: transferContent,
      });
      console.log('linked dynamic code OK');
    } catch (e) {
      console.warn('link warn', e.message);
    }
  }
  await client.close();
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
NODE`;

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
