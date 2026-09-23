/**
 * Seed QA SSE realtime (prefix QASSE_).
 * Chạy: npx tsx scripts/seed-sse-realtime-qa.ts
 * (Mongo URI từ env / tunnel như seed CTV khác)
 *
 * Tạo: SP, 2 CTV (1 cho_duyet + 1 active), buyer, đơn unpaid + đơn HH held.
 * Checklist: docs/qa-sse-realtime-checklist.md
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoClient, ObjectId } from "mongodb";
import { SHOP_COMMISSIONS } from "../backend/shopOrders/commissionModels.js";
import { SHOP_ORDERS } from "../backend/shopOrders/models.js";
import { SHOP_ACCOUNTS } from "../backend/shopAuth/models.js";

const TAG = "QASSE";
const PASS = "TestSse@2026";
const PROD_MA = "QASSE_PROD1";
const CTV_A = "QASSECTV";
const CTV_B = "QASSECTV2";
const ORD_UNPAID = "QASSE_ORD_UNPAID";
const ORD_HH = "QASSE_ORD_HH";

function uri() {
  return (
    process.env.SHOP_MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27018/aloha_shop_db"
  );
}

async function main() {
  const client = new MongoClient(uri());
  await client.connect();
  const shopDb = client.db();
  const hash = await bcrypt.hash(PASS, 10);
  const now = new Date().toISOString();

  // Cleanup prior seed
  await shopDb.collection(SHOP_ORDERS).deleteMany({ qaTag: TAG });
  await shopDb.collection(SHOP_COMMISSIONS).deleteMany({ qaTag: TAG });
  await shopDb.collection(SHOP_ACCOUNTS).deleteMany({ qaTag: TAG });
  await shopDb.collection("aloha_products").deleteMany({ ma: PROD_MA });

  await shopDb.collection("aloha_products").updateOne(
    { ma: PROD_MA },
    {
      $set: {
        ma: PROD_MA,
        ten: "QASSE Chậu test realtime",
        giaWeb: 99000,
        giaBan: 99000,
        ton: 50,
        isActive: true,
        hienThiWeb: true,
        updatedAt: now,
        qaTag: TAG,
      },
    },
    { upsert: true }
  );

  const buyerId = new ObjectId().toString();
  await shopDb.collection(SHOP_ACCOUNTS).insertOne({
    _id: buyerId as any,
    id: buyerId,
    email: "qasse-buyer@test.local",
    username: "qasse_buyer",
    fullName: "QASSE Buyer",
    phone: "0909999001",
    passwordHash: hash,
    roles: ["customer"],
    ctvStatus: null,
    ctvCode: null,
    createdAt: now,
    qaTag: TAG,
  });

  const ctvPendingId = new ObjectId().toString();
  await shopDb.collection(SHOP_ACCOUNTS).insertOne({
    _id: ctvPendingId as any,
    id: ctvPendingId,
    email: "qasse-ctv-pending@test.local",
    username: "qasse_ctv_pending",
    fullName: "QASSE CTV Chờ duyệt",
    phone: "0909999002",
    passwordHash: hash,
    roles: ["ctv"],
    ctvStatus: "cho_duyet",
    ctvCode: CTV_A,
    createdAt: now,
    qaTag: TAG,
  });

  const ctvActiveId = new ObjectId().toString();
  await shopDb.collection(SHOP_ACCOUNTS).insertOne({
    _id: ctvActiveId as any,
    id: ctvActiveId,
    email: "qasse-ctv-active@test.local",
    username: "qasse_ctv_active",
    fullName: "QASSE CTV Active",
    phone: "0909999003",
    passwordHash: hash,
    roles: ["ctv"],
    ctvStatus: "active",
    ctvCode: CTV_B,
    createdAt: now,
    qaTag: TAG,
  });

  await shopDb.collection(SHOP_ORDERS).insertOne({
    code: ORD_UNPAID,
    id: ORD_UNPAID,
    shopAccountId: buyerId,
    orderStatus: "cho_thanh_toan",
    paymentStatus: "unpaid",
    total: 99000,
    totalPayment: 99000,
    customerName: "QASSE Buyer",
    customerPhone: "0909999001",
    orderDetails: [
      {
        productCode: PROD_MA,
        ma: PROD_MA,
        productName: "QASSE Chậu test realtime",
        quantity: 1,
        qty: 1,
        price: 99000,
        gia: 99000,
      },
    ],
    createdAt: now,
    qaTag: TAG,
  });

  const eligibleAt = new Date(Date.now() + 3 * 86400_000).toISOString();
  await shopDb.collection(SHOP_ORDERS).insertOne({
    code: ORD_HH,
    id: ORD_HH,
    shopAccountId: buyerId,
    orderStatus: "hoan_thanh",
    paymentStatus: "paid",
    total: 99000,
    totalPayment: 99000,
    ctvCodes: [CTV_B],
    customerName: "QASSE Buyer",
    customerPhone: "0909999001",
    orderDetails: [
      {
        productCode: PROD_MA,
        ma: PROD_MA,
        productName: "QASSE Chậu test realtime",
        quantity: 1,
        qty: 1,
        price: 99000,
        gia: 99000,
        ctvCode: CTV_B,
      },
    ],
    deliveredAt: now,
    createdAt: now,
    qaTag: TAG,
  });

  await shopDb.collection(SHOP_COMMISSIONS).insertOne({
    orderCode: ORD_HH,
    ctvCode: CTV_B,
    ma: PROD_MA,
    productName: "QASSE Chậu test realtime",
    qty: 1,
    amount: 4950,
    rate: 5,
    status: "held",
    eligibleAt,
    createdAt: now,
    qaTag: TAG,
  });

  console.log(JSON.stringify({
    ok: true,
    password: PASS,
    product: PROD_MA,
    ctvPending: { code: CTV_A, email: "qasse-ctv-pending@test.local" },
    ctvActive: { code: CTV_B, email: "qasse-ctv-active@test.local" },
    buyer: "qasse-buyer@test.local",
    orders: [ORD_UNPAID, ORD_HH],
    checklist: "docs/qa-sse-realtime-checklist.md",
  }, null, 2));

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
