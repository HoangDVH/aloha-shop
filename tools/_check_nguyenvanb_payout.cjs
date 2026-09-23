const { MongoClient } = require("mongodb");

(async () => {
  const c = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27018");
  await c.connect();
  const db = c.db("aloha_shop_db");

  const acc = await db.collection("aloha_shop_accounts").findOne(
    {
      $or: [
        { ctvCode: /NGUYENVANB/i },
        { displayName: /Nguyễn Văn B/i },
        { fullName: /Nguyễn Văn B/i },
        { username: /nguyenvanb/i },
      ],
    },
    {
      projection: {
        username: 1,
        displayName: 1,
        fullName: 1,
        ctvCode: 1,
        ctvStatus: 1,
        phone: 1,
      },
    }
  );
  console.log("ACCOUNT=", JSON.stringify(acc, null, 2));

  const code = acc?.ctvCode || "NGUYENVANB";
  const comm = await db
    .collection("aloha_shop_commissions")
    .aggregate([
      { $match: { ctvCode: code } },
      { $group: { _id: "$status", n: { $sum: 1 }, amount: { $sum: "$amount" } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  console.log("COMM_BY_STATUS=", JSON.stringify(comm, null, 2));

  const paid = await db
    .collection("aloha_shop_commissions")
    .find({ ctvCode: code, status: "paid_out" })
    .project({ orderCode: 1, amount: 1, billingPeriod: 1, paidAt: 1, billId: 1 })
    .limit(20)
    .toArray();
  console.log("PAID_OUT=", JSON.stringify(paid, null, 2));

  const bills = await db
    .collection("aloha_shop_commission_bills")
    .find({ "ctvLines.ctvCode": code })
    .project({ period: 1, status: 1, "ctvLines.$": 1, paidAt: 1, lockedAt: 1 })
    .sort({ period: -1 })
    .limit(20)
    .toArray();
  console.log("BILLS_WITH_CTV=", JSON.stringify(bills, null, 2));

  // Also any bill that mentions this CTV in raw scan
  const allBills = await db
    .collection("aloha_shop_commission_bills")
    .find({})
    .project({ period: 1, status: 1, ctvLines: 1, paidAt: 1 })
    .sort({ period: -1 })
    .limit(10)
    .toArray();
  console.log(
    "RECENT_BILLS=",
    JSON.stringify(
      allBills.map((b) => ({
        period: b.period,
        status: b.status,
        paidAt: b.paidAt,
        ctvCodes: (b.ctvLines || []).map((x) => x.ctvCode),
      })),
      null,
      2
    )
  );

  await c.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
