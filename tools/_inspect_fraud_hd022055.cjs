/**
 * Inspect why HD022055 / commission is flagged as fraud.
 * Tries local Mongo tunnel then VPS.
 */
const { createRequire } = require("module");
const path = require("path");
const fs = require("fs");

async function inspectLocal() {
  try {
    const { MongoClient } = require("mongodb");
    const uri =
      process.env.MONGO_URI ||
      process.env.SHOP_MONGO_URL ||
      "mongodb://127.0.0.1:27018";
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2500 });
    await client.connect();
    const db = client.db("aloha_shop_db");
    const order = await db.collection("aloha_shop_orders").findOne({
      $or: [
        { kvInvoiceCode: "HD022055" },
        { code: "HD022055" },
        { kvInvoiceCode: /HD022055/i },
      ],
    });
    const commissions = await db
      .collection("aloha_shop_commissions")
      .find({
        $or: [
          { displayOrderCode: "HD022055" },
          { orderCode: /HD022055/i },
          { kvInvoiceCode: "HD022055" },
        ],
      })
      .toArray();
    const fraud = await db
      .collection("aloha_shop_ctv_fraud_events")
      .find({
        $or: [
          { orderCode: order?.code },
          { displayOrderCode: "HD022055" },
          { "details": /HD022055/ },
          { ctvCode: "NGUYENVANB" },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    console.log(
      JSON.stringify(
        {
          source: "local",
          order: order
            ? {
                code: order.code,
                kvInvoiceCode: order.kvInvoiceCode,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                shopAccountId: order.shopAccountId,
                ctvCodes: order.ctvCodes,
                shippingAddress: order.shippingAddress,
                ward: order.ward,
                province: order.province,
                paymentStatus: order.paymentStatus,
                orderStatus: order.orderStatus,
              }
            : null,
          commissions: commissions.map((c) => ({
            id: c.id,
            ctvCode: c.ctvCode,
            status: c.status,
            amount: c.amount,
            ma: c.ma,
            flagReason: c.flagReason || c.fraudReason || c.notes,
            fraudType: c.fraudType,
            flaggedAt: c.flaggedAt,
            details: c.details,
          })),
          fraud,
        },
        null,
        2
      )
    );
    await client.close();
    return true;
  } catch (e) {
    console.error("local_fail", e.message);
    return false;
  }
}

async function inspectVps() {
  function loadSsh2() {
    try {
      return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
    } catch {
      return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
    }
  }
  const { Client } = loadSsh2();
  const remoteCmd = `
cd /root/aloha-shop
node <<'NODE'
const { MongoClient } = require('mongodb');
(async () => {
  const client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('aloha_shop_db');
  const order = await db.collection('aloha_shop_orders').findOne({
    $or: [{ kvInvoiceCode: 'HD022055' }, { code: 'HD022055' }]
  });
  const commissions = await db.collection('aloha_shop_commissions').find({
    $or: [
      { displayOrderCode: 'HD022055' },
      { orderCode: order ? order.code : '___' },
      { kvInvoiceCode: 'HD022055' }
    ]
  }).toArray();
  const fraudCols = ['aloha_shop_ctv_fraud_events', 'shop_ctv_fraud_events'];
  let fraud = [];
  for (const col of fraudCols) {
    try {
      const rows = await db.collection(col).find({
        $or: [
          { orderCode: order && order.code },
          { displayOrderCode: 'HD022055' },
          { ctvCode: 'NGUYENVANB' },
          { ctvCode: /NGUYENVANB/i }
        ].filter(Boolean)
      }).sort({ createdAt: -1 }).limit(30).toArray();
      if (rows.length) fraud = fraud.concat(rows.map(r => ({ col, ...r })));
    } catch {}
  }
  // also search any fraud mentioning this invoice
  for (const col of fraudCols) {
    try {
      const rows = await db.collection(col).find({
        $or: [
          { details: { $elemMatch: { $regex: 'HD022055' } } },
          { note: /HD022055/ },
        ]
      }).limit(20).toArray();
      fraud = fraud.concat(rows.map(r => ({ col, via: 'text', type: r.type, details: r.details, ctvCode: r.ctvCode, orderCode: r.orderCode, createdAt: r.createdAt })));
    } catch {}
  }
  let ctvAcc = null;
  if (commissions[0]?.ctvCode || order?.ctvCodes?.[0]) {
    const code = commissions[0]?.ctvCode || order.ctvCodes[0];
    ctvAcc = await db.collection('aloha_shop_accounts').findOne({ ctvCode: code });
  }
  let buyer = null;
  if (order?.shopAccountId) {
    buyer = await db.collection('aloha_shop_accounts').findOne({
      $or: [{ id: order.shopAccountId }, { _id: order.shopAccountId }]
    });
  }
  console.log(JSON.stringify({
    source: 'vps',
    order: order && {
      code: order.code,
      kvInvoiceCode: order.kvInvoiceCode,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      shopAccountId: order.shopAccountId,
      ctvCodes: order.ctvCodes,
      shippingAddress: order.shippingAddress,
      ward: order.ward,
      province: order.province,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
    },
    commissions: commissions.map(c => ({
      id: c.id, ctvCode: c.ctvCode, status: c.status, amount: c.amount, ma: c.ma,
      flagReason: c.flagReason || c.fraudReason || null,
      fraudFlags: c.fraudFlags || null,
      notes: c.notes || null,
      allKeys: Object.keys(c).filter(k => /flag|fraud|reason|detail/i.test(k))
    })),
    fraud: fraud.map(f => ({
      col: f.col, type: f.type, ctvCode: f.ctvCode, orderCode: f.orderCode,
      displayOrderCode: f.displayOrderCode, details: f.details, createdAt: f.createdAt, status: f.status
    })),
    ctvAcc: ctvAcc && {
      fullName: ctvAcc.fullName, phone: ctvAcc.phone, email: ctvAcc.email,
      ctvCode: ctvAcc.ctvCode, ctvStatus: ctvAcc.ctvStatus, id: ctvAcc.id,
      address: ctvAcc.addresses && ctvAcc.addresses[0]
    },
    buyer: buyer && {
      fullName: buyer.fullName, phone: buyer.phone, email: buyer.email,
      id: buyer.id, roles: buyer.roles, ctvCode: buyer.ctvCode
    }
  }, null, 2));
  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
NODE
`;
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on("ready", () => {
      c.exec(remoteCmd, (err, stream) => {
        if (err) {
          c.end();
          return reject(err);
        }
        let out = "";
        stream.on("data", (d) => {
          out += d;
          process.stdout.write(d);
        });
        stream.stderr.on("data", (d) => process.stderr.write(d));
        stream.on("close", () => {
          c.end();
          resolve(out);
        });
      });
    });
    c.on("error", reject);
    c.connect({
      host: "160.25.167.211",
      port: 22,
      username: "root",
      password: process.env.VPS_PASSWORD || "aloha2026@",
    });
  });
}

(async () => {
  const ok = await inspectLocal();
  if (!ok) await inspectVps();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
