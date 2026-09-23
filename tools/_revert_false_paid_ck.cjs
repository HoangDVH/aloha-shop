/**
 * Revert false-paid Transfer orders (Status=1 heuristic bug) back to unpaid + restore stock.
 * Usage on VPS: node tools/_revert_false_paid_ck.cjs WEB-260918-KAL7
 */
require("dotenv").config();
const { MongoClient } = require("mongodb");

const codes = process.argv.slice(2);
if (!codes.length) {
  console.error("Usage: node _revert_false_paid_ck.cjs <orderCode>...");
  process.exit(1);
}

async function main() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
  const dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
  const client = new MongoClient(uri);
  await client.connect();
  const shopDb = client.db(dbName);
  const orders = shopDb.collection("aloha_shop_orders");
  const products = shopDb.collection("aloha_products");
  const now = new Date().toISOString();
  const ttlMin = Number(process.env.SHOP_TRANSFER_TTL_MIN || 30) || 30;
  const expiresAt = new Date(Date.now() + ttlMin * 60_000).toISOString();

  for (const raw of codes) {
    const code = String(raw).trim();
    const o = await orders.findOne({
      $or: [{ code }, { kvInvoiceCode: code }, { id: code }],
    });
    if (!o) {
      console.log("NOT_FOUND", code);
      continue;
    }
    if (String(o.method) !== "Transfer") {
      console.log("SKIP_NOT_TRANSFER", o.code);
      continue;
    }
    console.log("revert", o.code, "hd", o.kvInvoiceCode, "was", o.paymentStatus);

    // Restore stock if deducted
    if (o.stockApplied) {
      const details = Array.isArray(o.orderDetails) ? o.orderDetails : [];
      for (const d of details) {
        if (d.preOrder) continue;
        const ma = String(d.productCode || "").trim().toUpperCase();
        const qty = Math.max(1, Math.floor(Number(d.quantity) || 1));
        if (!ma) continue;
        const prod = await products.findOne({
          $or: [{ ma }, { ma: ma.toLowerCase() }],
          deletedAt: null,
        });
        if (!prod) {
          console.log("  product_missing", ma);
          continue;
        }
        const $inc = {};
        if (prod.ton != null) $inc.ton = qty;
        if (prod.onHand != null) $inc.onHand = qty;
        if (prod.kvTon != null) $inc.kvTon = qty;
        if (prod.tonKho != null) $inc.tonKho = qty;
        if (Object.keys($inc).length) {
          await products.updateOne({ _id: prod._id }, { $inc, $set: { updatedAt: now } });
          console.log("  stock+", ma, qty, $inc);
        } else {
          console.log("  stock_skip_no_fields", ma);
        }
      }
    }

    await orders.updateOne(
      { _id: o._id },
      {
        $set: {
          paymentStatus: "unpaid",
          orderStatus: "cho_thanh_toan",
          status: "cho",
          statusValue: "Chờ chuyển khoản",
          kvInvoiceMode: "awaiting",
          stockApplied: false,
          expiresAt,
          updatedAt: now,
          falsePaidRevertedAt: now,
          falsePaidRevertedReason: "kv_status1_not_paid",
        },
        $unset: {
          paidAt: "",
          paidSource: "",
          confirmedBy: "",
          paymentFailReason: "",
        },
      }
    );
    console.log("  -> unpaid, expiresAt", expiresAt);
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
