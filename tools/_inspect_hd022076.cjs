require("dotenv").config();
const { MongoClient } = require("mongodb");

async function main() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27018";
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
  const code = "HD022076";
  const o = await db.collection("aloha_shop_orders").findOne({
    $or: [{ code }, { kvInvoiceCode: code }, { id: code }],
  });
  if (!o) {
    console.log("ORDER_NOT_FOUND");
    await client.close();
    return;
  }
  console.log(
    JSON.stringify(
      {
        code: o.code,
        id: o.id,
        method: o.method,
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        total: o.total,
        totalPayment: o.totalPayment,
        kvInvoiceId: o.kvInvoiceId,
        kvInvoiceCode: o.kvInvoiceCode,
        paymentCode: o.paymentCode,
        bankTransferContent: o.bankTransferContent,
        customerReportedPaidAt: o.customerReportedPaidAt,
        paidAt: o.paidAt,
        paidSource: o.paidSource,
        confirmedBy: o.confirmedBy,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        expiresAt: o.expiresAt,
      },
      null,
      2
    )
  );
  await client.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
