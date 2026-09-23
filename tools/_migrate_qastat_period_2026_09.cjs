/**
 * Gắn QASTATPAID vào kỳ UI đang xem (2026-09).
 * Seed dùng 2099-06 nên tab "Kỳ tháng / thanh toán" không thấy.
 */
require("dotenv").config();
const { MongoClient } = require("mongodb");

const PERIOD = process.env.QASTAT_PERIOD || "2026-09";
const MONGO = process.env.MONGO_URI || "mongodb://127.0.0.1:27018";
const DB = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";

async function main() {
  const client = new MongoClient(MONGO);
  await client.connect();
  const db = client.db(DB);
  const bills = db.collection("aloha_shop_commission_bills");
  const comms = db.collection("aloha_shop_commissions");
  const now = new Date().toISOString();

  const paidRow = await comms.findOne({ qaTag: "QASTAT", ctvCode: "QASTATPAID" });
  if (!paidRow) throw new Error("missing QASTATPAID commission");
  const paidAmt = Number(paidRow.amount) || 0;

  await comms.updateOne(
    { _id: paidRow._id },
    {
      $set: {
        status: "paid_out",
        billingPeriod: PERIOD,
        eligibleAt: `${PERIOD}-15T00:00:00.000Z`,
        paidOutAt: paidRow.paidOutAt || now,
        paidOutBy: paidRow.paidOutBy || "qa_seed",
        updatedAt: now,
      },
    }
  );

  // Giữ bill ảo billed riêng (không đụng kỳ 2026-09 đang paid)
  const billRow = await comms.findOne({ qaTag: "QASTAT", ctvCode: "QASTATBILL" });
  if (billRow) {
    await bills.deleteMany({ period: "2099-06" });
    await bills.updateOne(
      { period: "2099-05" },
      {
        $set: {
          id: "BILL-2099-05",
          period: "2099-05",
          status: "locked",
          settleDay: 18,
          lockedAt: now,
          lockedBy: "qa_seed",
          totals: {
            commission: Number(billRow.amount) || 0,
            orderCount: 1,
            ctvCount: 1,
            adjustments: 0,
            lineCount: 1,
          },
          ctvLines: [
            {
              ctvCode: "QASTATBILL",
              gross: Number(billRow.amount) || 0,
              adjustments: 0,
              net: Number(billRow.amount) || 0,
              orderCount: 1,
              lineCount: 1,
            },
          ],
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    await comms.updateOne(
      { _id: billRow._id },
      {
        $set: {
          status: "billed",
          billingPeriod: "2099-05",
          eligibleAt: "2099-05-15T00:00:00.000Z",
          updatedAt: now,
        },
      }
    );
  }

  const linePaid = {
    ctvCode: "QASTATPAID",
    gross: paidAmt,
    adjustments: 0,
    net: paidAmt,
    orderCount: 1,
    lineCount: 1,
    paidAt: now,
  };

  let bill = await bills.findOne({ period: PERIOD });
  if (!bill) {
    await bills.insertOne({
      id: `BILL-${PERIOD}`,
      period: PERIOD,
      status: "paid",
      settleDay: 18,
      lockedAt: now,
      lockedBy: "qa_seed",
      paidAt: now,
      paidBy: "qa_seed",
      totals: {
        commission: paidAmt,
        orderCount: 1,
        ctvCount: 1,
        adjustments: 0,
        lineCount: 1,
      },
      ctvLines: [linePaid],
      createdAt: now,
      updatedAt: now,
    });
    console.log("created", PERIOD);
  } else {
    const lines = Array.isArray(bill.ctvLines) ? [...bill.ctvLines] : [];
    const without = lines.filter((l) => String(l.ctvCode || "") !== "QASTATPAID");
    const next = [...without, linePaid];
    const commission = next.reduce((s, l) => s + (Number(l.net) || 0), 0);
    const orderCount = next.reduce((s, l) => s + (Number(l.orderCount) || 0), 0);
    await bills.updateOne(
      { period: PERIOD },
      {
        $set: {
          ctvLines: next,
          totals: {
            ...(bill.totals || {}),
            commission,
            orderCount,
            ctvCount: next.length,
            lineCount: next.length,
            adjustments: Number(bill.totals?.adjustments) || 0,
          },
          updatedAt: now,
        },
      }
    );
    console.log("updated", PERIOD, "ctvCount", next.length, "commission", commission);
  }

  // dọn bill 2099-06 rỗng
  await bills.deleteMany({ period: "2099-06" });

  const check = await bills.findOne({ period: PERIOD });
  console.log(
    JSON.stringify(
      {
        period: check.period,
        status: check.status,
        totals: check.totals,
        codes: (check.ctvLines || []).map((l) => l.ctvCode),
      },
      null,
      2
    )
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
