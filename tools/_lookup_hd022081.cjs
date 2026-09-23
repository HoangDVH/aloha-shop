const { MongoClient } = require("mongodb");

(async () => {
  const c = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27018");
  await c.connect();
  const db = c.db("aloha_shop_db");
  const ord = await db.collection("aloha_shop_orders").findOne(
    {
      $or: [
        { kvInvoiceCode: "HD022081" },
        { kvOrderCode: "HD022081" },
        { code: "HD022081" },
        { legacyCodes: "HD022081" },
        { kvInvoiceCode: /022081/i },
        { code: /022081/i },
      ],
    },
    {
      projection: {
        code: 1,
        kvInvoiceCode: 1,
        kvOrderCode: 1,
        ctvCodes: 1,
        orderStatus: 1,
        paymentStatus: 1,
        deliveredAt: 1,
        createdAt: 1,
        paidAt: 1,
        "orderDetails.ctvCode": 1,
        "orderDetails.productCode": 1,
        "orderDetails.productName": 1,
        customerName: 1,
        source: 1,
      },
    }
  );
  console.log("ORDER=", JSON.stringify(ord, null, 2));
  if (ord) {
    const comm = await db
      .collection("aloha_shop_commissions")
      .find({ orderCode: ord.code })
      .project({ orderCode: 1, ctvCode: 1, status: 1, amount: 1, ma: 1 })
      .toArray();
    console.log("COMMISSIONS=", JSON.stringify(comm, null, 2));
  } else {
    const near = await db
      .collection("aloha_shop_orders")
      .find({ kvInvoiceCode: /HD0220(7|8)/i })
      .project({
        code: 1,
        kvInvoiceCode: 1,
        ctvCodes: 1,
        orderStatus: 1,
        paymentStatus: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    console.log("NEAR=", JSON.stringify(near, null, 2));
  }
  await c.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
