/**
 * Seed CTV + đơn + HH demo cho từng tab admin:
 *   held | eligible | billed | paid_out | cancelled | flagged (self-buy SĐT)
 *
 * Chạy (qua tunnel VPS :27018):
 *   npx tsx scripts/seed-ctv-status-demo.ts
 *
 * Tag: qaTag=QASTAT — cleanup trước khi seed lại.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
import {
  clearHeldCommissions,
  holdCommissionsForOrder,
  lockMonthlyBill,
  markBillPaid,
  voidCommissionsForOrder,
} from "../backend/shopOrders/commission.js";
import {
  SHOP_COMMISSION_BILLS,
  SHOP_COMMISSIONS,
  SHOP_CTV_FRAUD_EVENTS,
} from "../backend/shopOrders/commissionModels.js";
import { SHOP_ORDERS } from "../backend/shopOrders/models.js";
import { SHOP_ACCOUNTS } from "../backend/shopAuth/models.js";

const TAG = "QASTAT";
const PREFIX = "QASTAT";
const PASS = "TestCtv@2026";
/** Kỳ demo: mặc định tháng hiện tại (UTC) — khớp filter admin "Kỳ TT". Override: QASTAT_PERIOD_BILL / QASTAT_PERIOD_PAID */
function defaultPeriod(offsetMonths = 0): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const PERIOD_PAID = process.env.QASTAT_PERIOD_PAID || defaultPeriod(0);
/** billed: tháng trước nếu khác paid, để có 2 kỳ demo */
const PERIOD_BILL =
  process.env.QASTAT_PERIOD_BILL ||
  (() => {
    const prev = defaultPeriod(-1);
    return prev === PERIOD_PAID ? "2099-05" : prev;
  })();

type CaseId =
  | "held"
  | "eligible"
  | "billed"
  | "paid_out"
  | "cancelled"
  | "flagged";

const CASES: Array<{
  id: CaseId;
  ctvCode: string;
  username: string;
  phone: string;
  label: string;
}> = [
  {
    id: "held",
    ctvCode: `${PREFIX}HELD`,
    username: "qastat_held",
    phone: "0901111001",
    label: "Đang giữ",
  },
  {
    id: "eligible",
    ctvCode: `${PREFIX}ELEG`,
    username: "qastat_eleg",
    phone: "0901111002",
    label: "Đủ điều kiện",
  },
  {
    id: "billed",
    ctvCode: `${PREFIX}BILL`,
    username: "qastat_bill",
    phone: "0901111003",
    label: "Đã vào kỳ",
  },
  {
    id: "paid_out",
    ctvCode: `${PREFIX}PAID`,
    username: "qastat_paid",
    phone: "0901111004",
    label: "Đã thanh toán",
  },
  {
    id: "cancelled",
    ctvCode: `${PREFIX}CANC`,
    username: "qastat_canc",
    phone: "0901111005",
    label: "Đã hủy",
  },
  {
    id: "flagged",
    ctvCode: `${PREFIX}FLAG`,
    username: "qastat_flag",
    phone: "0901111999",
    label: "Nghi gian lận (tự mua cùng SĐT)",
  },
];

function orderCode(id: CaseId) {
  return `${PREFIX}DH_${id.toUpperCase()}`;
}

async function main() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27018";
  const dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
  console.log("Mongo", uri.replace(/\/\/.*@/, "//***@"), "db", dbName);

  const client = new MongoClient(uri);
  await client.connect();
  const shopDb = client.db(dbName);
  const mainDb = client.db(dbName);
  const hash = await bcrypt.hash(PASS, 10);
  const now = new Date();
  const nowIso = now.toISOString();

  // —— cleanup cũ ——
  const codes = CASES.map((c) => c.ctvCode);
  const orderCodes = CASES.map((c) => orderCode(c.id));
  const usernames = CASES.map((c) => c.username);
  await shopDb.collection(SHOP_COMMISSIONS).deleteMany({
    $or: [{ qaTag: TAG }, { orderCode: { $in: orderCodes } }, { ctvCode: { $in: codes } }],
  });
  await shopDb.collection(SHOP_ORDERS).deleteMany({
    $or: [{ qaTag: TAG }, { code: { $in: orderCodes } }],
  });
  await shopDb.collection(SHOP_ACCOUNTS).deleteMany({
    $or: [{ qaTag: TAG }, { ctvCode: { $in: codes } }, { username: { $in: usernames } }],
  });
  await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).deleteMany({
    $or: [{ qaTag: TAG }, { orderCode: { $in: orderCodes } }, { ctvCode: { $in: codes } }],
  });
  await shopDb.collection(SHOP_COMMISSION_BILLS).deleteMany({
    period: { $in: [PERIOD_BILL, PERIOD_PAID] },
  });
  console.log("cleaned previous", TAG);

  const prod = await mainDb.collection("aloha_products").findOne(
    {
      ma: { $exists: true, $ne: "" },
      $or: [{ giaWeb: { $gt: 0 } }, { gia: { $gt: 0 } }],
      ctvExcluded: { $ne: true },
    },
    { projection: { ma: 1, ten: 1, giaWeb: 1, gia: 1 } }
  );
  if (!prod?.ma) throw new Error("Không có sản phẩm để gắn hoa hồng");
  const ma = String(prod.ma).toUpperCase();
  const price = Number(prod.giaWeb) || Number(prod.gia) || 100000;
  await mainDb.collection("aloha_products").updateOne(
    { _id: prod._id },
    { $set: { ctvCommissionRate: 10, ctvExcluded: false } }
  );
  console.log("product", ma, "price", price);

  const summary: Array<{
    tab: string;
    ctv: string;
    phone: string;
    order: string;
    status: string;
    flags?: string;
  }> = [];

  for (const c of CASES) {
    await shopDb.collection(SHOP_ACCOUNTS).insertOne({
      username: c.username,
      email: `${c.username}@qastat.local`,
      passwordHash: hash,
      displayName: `QA ${c.label}`,
      phone: c.phone,
      roles: ["ctv"],
      ctvStatus: "active",
      ctvCode: c.ctvCode,
      active: true,
      qaTag: TAG,
      createdAt: nowIso,
      updatedAt: nowIso,
      payoutBank: {
        bankBin: "970436",
        bankName: "Vietcombank",
        accountNumber: `10${c.phone.slice(-8)}`,
        accountName: `QA ${c.ctvCode}`,
      },
    });

    const buyerPhone = c.id === "flagged" ? c.phone : `091${c.phone.slice(-7)}`;
    const createdAt = new Date(now.getTime() - 2 * 86400_000).toISOString();
    const deliveredAt = new Date(now.getTime() - 1 * 86400_000).toISOString();
    const oc = orderCode(c.id);

    await shopDb.collection(SHOP_ORDERS).insertOne({
      code: oc,
      orderStatus: "hoan_thanh",
      paymentStatus: "cod",
      usingCod: true,
      method: "Cash",
      createdAt,
      updatedAt: nowIso,
      deliveredAt,
      customerName: c.id === "flagged" ? `QA SelfBuy ${c.ctvCode}` : `QA Buyer ${c.ctvCode}`,
      customerPhone: buyerPhone,
      customerAddress: "12 Nguyen Trai, Q1, HCM",
      shippingAddress: "12 Nguyen Trai",
      ward: "Ben Thanh",
      province: "Ho Chi Minh",
      orderDetails: [
        {
          productCode: ma,
          productName: String(prod.ten || ma),
          quantity: 1,
          price,
          discount: 0,
          ctvCode: c.ctvCode,
        },
      ],
      ctvCode: c.ctvCode,
      ctvCodes: [c.ctvCode],
      qaTag: TAG,
    });

    const order = await shopDb.collection(SHOP_ORDERS).findOne({ code: oc });
    const hold = await holdCommissionsForOrder(shopDb, mainDb, order as any);
    let row = await shopDb.collection(SHOP_COMMISSIONS).findOne({ orderCode: oc });
    if (!row) {
      throw new Error(
        `Không tạo được HH cho ${oc}: hold=${JSON.stringify(hold)}`
      );
    }
    await shopDb.collection(SHOP_COMMISSIONS).updateOne(
      { _id: row._id },
      { $set: { qaTag: TAG } }
    );

    if (c.id === "held") {
      // giữ held: eligibleAt tương lai
      await shopDb.collection(SHOP_COMMISSIONS).updateOne(
        { _id: row._id },
        {
          $set: {
            status: "held",
            eligibleAt: new Date(now.getTime() + 5 * 86400_000).toISOString(),
            updatedAt: nowIso,
          },
        }
      );
    } else if (c.id === "eligible") {
      await shopDb.collection(SHOP_COMMISSIONS).updateOne(
        { _id: row._id },
        {
          $set: {
            status: "held",
            eligibleAt: new Date(now.getTime() - 86400_000).toISOString(),
            updatedAt: nowIso,
          },
        }
      );
      await clearHeldCommissions(shopDb);
    } else if (c.id === "billed") {
      await shopDb.collection(SHOP_COMMISSIONS).updateOne(
        { _id: row._id },
        {
          $set: {
            status: "eligible",
            eligibleAt: `${PERIOD_BILL}-15T00:00:00.000Z`,
            updatedAt: nowIso,
          },
        }
      );
      const lock = await lockMonthlyBill(shopDb, PERIOD_BILL, "qa_seed");
      if (!lock.ok) throw new Error(`lock ${PERIOD_BILL}: ${lock.error}`);
    } else if (c.id === "paid_out") {
      await shopDb.collection(SHOP_COMMISSIONS).updateOne(
        { _id: row._id },
        {
          $set: {
            status: "eligible",
            eligibleAt: `${PERIOD_PAID}-15T00:00:00.000Z`,
            updatedAt: nowIso,
          },
        }
      );
      const lock = await lockMonthlyBill(shopDb, PERIOD_PAID, "qa_seed");
      if (!lock.ok) throw new Error(`lock ${PERIOD_PAID}: ${lock.error}`);
      const paid = await markBillPaid(shopDb, PERIOD_PAID, {
        ctvCode: c.ctvCode,
        paidBy: "qa_seed",
      });
      if (!paid.ok) throw new Error(`mark paid: ${paid.error}`);
    } else if (c.id === "cancelled") {
      await voidCommissionsForOrder(shopDb, oc, { reason: "qa_status_demo" });
    } else if (c.id === "flagged") {
      if (String(row.status) !== "flagged") {
        throw new Error(
          `Self-buy chưa flagged: status=${row.status} flags=${JSON.stringify(row.fraudFlags)}`
        );
      }
      await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).updateMany(
        { orderCode: oc },
        { $set: { qaTag: TAG } }
      );
    }

    row = await shopDb.collection(SHOP_COMMISSIONS).findOne({ orderCode: oc });
    summary.push({
      tab: c.label,
      ctv: c.ctvCode,
      phone: c.phone,
      order: oc,
      status: String(row?.status || "?"),
      flags: Array.isArray(row?.fraudFlags) ? row!.fraudFlags.join(",") : "",
    });
    console.log(
      `OK ${c.id.padEnd(10)} ${c.ctvCode} phone=${c.phone} buyer=${buyerPhone} → ${row?.status}`
    );
  }

  const counts: Record<string, number> = {};
  for (const s of [
    "held",
    "eligible",
    "billed",
    "paid_out",
    "cancelled",
    "flagged",
  ]) {
    counts[s] = await shopDb.collection(SHOP_COMMISSIONS).countDocuments({
      qaTag: TAG,
      status: s,
    });
  }
  console.log("\n=== QASTAT summary (admin tabs) ===");
  console.table(summary);
  console.log("counts", counts);
  console.log(`\nLogin demo: user qastat_* / pass ${PASS}`);
  console.log("Xem admin: /admin/ctv/hoa-hong — lọc từng tab.");
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
