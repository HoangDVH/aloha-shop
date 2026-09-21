/**
 * Seed 2 CTV có HH status=eligible (kỳ tháng hiện tại) để test admin:
 *   1) Chốt kỳ  → eligible → billed («Đã vào kỳ»)
 *   2) Đã chuyển khoản xong → billed → paid_out («Đã thanh toán»)
 *
 * Không tự chốt / không tự mark-paid — để admin tự bấm 2 nút.
 *
 * Chạy (tunnel Mongo VPS :27018):
 *   npx tsx scripts/seed-ctv-eligible-payout-test.ts
 *   # hoặc reset bill kỳ để mở lại nút chốt:
 *   QAELIG_RESET_BILL=1 npx tsx scripts/seed-ctv-eligible-payout-test.ts
 *
 * Cleanup tag: qaTag=QAPAY2
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
import {
  clearHeldCommissions,
  holdCommissionsForOrder,
} from "../backend/shopOrders/commission.js";
import {
  SHOP_COMMISSION_BILLS,
  SHOP_COMMISSIONS,
  SHOP_CTV_FRAUD_EVENTS,
} from "../backend/shopOrders/commissionModels.js";
import { SHOP_ORDERS } from "../backend/shopOrders/models.js";
import { SHOP_ACCOUNTS } from "../backend/shopAuth/models.js";

const TAG = "QAPAY2";
const PASS = "TestCtv@2026";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 2 CTV khác nhau — HH đủ điều kiện, admin tự chốt kỳ */
const CTVS = [
  {
    ctvCode: "QAHUNG",
    username: "qa_hung",
    phone: "0904444001",
    displayName: "Lê Văn Hùng",
    orderCode: "QAPAYDH_HUNG",
  },
  {
    ctvCode: "QAHUE",
    username: "qa_hue",
    phone: "0904444002",
    displayName: "Phạm Thị Huệ",
    orderCode: "QAPAYDH_HUE",
  },
] as const;

async function main() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27018";
  const dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
  const period = process.env.QAELIG_PERIOD || currentPeriod();
  console.log("Mongo", uri.replace(/\/\/.*@/, "//***@"), "db", dbName, "period", period);

  const client = new MongoClient(uri);
  await client.connect();
  const shopDb = client.db(dbName);
  const hash = await bcrypt.hash(PASS, 10);
  const now = new Date();
  const nowIso = now.toISOString();

  const codes = CTVS.map((c) => c.ctvCode);
  const orderCodes = CTVS.map((c) => c.orderCode);
  const usernames = CTVS.map((c) => c.username);

  await shopDb.collection(SHOP_COMMISSIONS).deleteMany({
    $or: [{ qaTag: TAG }, { orderCode: { $in: [...orderCodes] } }, { ctvCode: { $in: [...codes] } }],
  });
  await shopDb.collection(SHOP_ORDERS).deleteMany({
    $or: [{ qaTag: TAG }, { code: { $in: [...orderCodes] } }],
  });
  await shopDb.collection(SHOP_ACCOUNTS).deleteMany({
    $or: [{ qaTag: TAG }, { ctvCode: { $in: [...codes] } }, { username: { $in: [...usernames] } }],
  });
  await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).deleteMany({
    $or: [{ qaTag: TAG }, { orderCode: { $in: [...orderCodes] } }, { ctvCode: { $in: [...codes] } }],
  });

  // Không xóa bill kỳ nếu đã locked — chỉ seed thêm eligible.
  // Nếu cần mở lại nút «Lấy danh sách…»: xóa bill kỳ thủ công hoặc set QAELIG_RESET_BILL=1
  if (process.env.QAELIG_RESET_BILL === "1") {
    const billDel = await shopDb.collection(SHOP_COMMISSION_BILLS).deleteOne({ period });
    console.log("billDeleted", billDel.deletedCount, "period", period);
  } else {
    console.log("cleaned", TAG, "(giữ bill kỳ", period, "nếu có)");
  }

  const prod = await shopDb.collection("aloha_products").findOne(
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
  await shopDb.collection("aloha_products").updateOne(
    { _id: prod._id },
    { $set: { ctvCommissionRate: 10, ctvExcluded: false } }
  );
  console.log("product", ma, "price", price);

  // eligibleAt giữa kỳ — lockMonthlyBill lọc eligibleAt trong [periodStart, periodEnd)
  const [yy, mm] = period.split("-").map(Number);
  const eligibleAt = new Date(Date.UTC(yy, mm - 1, 10, 12, 0, 0)).toISOString();
  const createdAt = new Date(Date.UTC(yy, mm - 1, 5, 10, 0, 0)).toISOString();
  const deliveredAt = new Date(Date.UTC(yy, mm - 1, 8, 10, 0, 0)).toISOString();

  const summary: Array<Record<string, string | number>> = [];

  for (const c of CTVS) {
    await shopDb.collection(SHOP_ACCOUNTS).insertOne({
      username: c.username,
      email: `${c.username}@qaelig.local`,
      passwordHash: hash,
      displayName: c.displayName,
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
        accountName: c.displayName.toUpperCase(),
      },
    });

    const buyerPhone = `091${c.phone.slice(-7)}`;
    await shopDb.collection(SHOP_ORDERS).insertOne({
      code: c.orderCode,
      orderStatus: "hoan_thanh",
      paymentStatus: "cod",
      usingCod: true,
      method: "Cash",
      createdAt,
      updatedAt: nowIso,
      deliveredAt,
      customerName: `Buyer ${c.ctvCode}`,
      customerPhone: buyerPhone,
      customerAddress: "90 Nguyen Trai, Q1, HCM",
      shippingAddress: "90 Nguyen Trai",
      ward: "Ben Thanh",
      province: "Ho Chi Minh",
      orderDetails: [
        {
          productCode: ma,
          productName: String(prod.ten || ma),
          quantity: 2,
          price,
          discount: 0,
          ctvCode: c.ctvCode,
        },
      ],
      ctvCode: c.ctvCode,
      ctvCodes: [c.ctvCode],
      qaTag: TAG,
    });

    const order = await shopDb.collection(SHOP_ORDERS).findOne({ code: c.orderCode });
    const hold = await holdCommissionsForOrder(shopDb, shopDb, order as any);
    let row = await shopDb.collection(SHOP_COMMISSIONS).findOne({ orderCode: c.orderCode });
    if (!row) {
      throw new Error(`Không tạo HH ${c.orderCode}: ${JSON.stringify(hold)}`);
    }

    await shopDb.collection(SHOP_COMMISSIONS).updateOne(
      { _id: row._id },
      {
        $set: {
          qaTag: TAG,
          status: "held",
          eligibleAt,
          updatedAt: nowIso,
        },
      }
    );
    await clearHeldCommissions(shopDb);

    row = await shopDb.collection(SHOP_COMMISSIONS).findOne({ orderCode: c.orderCode });
    if (String(row?.status) !== "eligible") {
      throw new Error(`Expect eligible, got ${row?.status} for ${c.orderCode}`);
    }

    summary.push({
      ctv: c.ctvCode,
      user: c.username,
      order: c.orderCode,
      status: String(row?.status),
      amount: Number(row?.amount) || 0,
      eligibleAt: String(row?.eligibleAt || ""),
    });
    console.log("OK", c.ctvCode, "→", row?.status, "amount", row?.amount);
  }

  const eligibleN = await shopDb.collection(SHOP_COMMISSIONS).countDocuments({
    qaTag: TAG,
    status: "eligible",
  });
  const bill = await shopDb.collection(SHOP_COMMISSION_BILLS).findOne({ period });

  console.log("\n=== QAPAY2 ready ===");
  console.table(summary);
  console.log("eligible lines:", eligibleN);
  console.log("bill kỳ", period, ":", bill ? bill.status : "(chưa có — bấm Lấy danh sách CTV đủ điều kiện)");
  console.log(`\nLogin CTV: ${CTVS.map((c) => c.username).join(" / ")}  pass ${PASS}`);
  console.log(`Admin: /admin/ctv/hoa-hong → Kỳ TT = ${period}`);
  console.log("  Tab «Đủ điều kiện» phải thấy QAHUNG + QAHUE.");
  console.log("  1) «Lấy danh sách CTV đủ điều kiện» (chốt kỳ)");
  console.log("  2) «Đã chuyển khoản xong»");

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
