/**
 * Seed hồ sơ sỉ tỉnh chờ duyệt (đầy đủ thông tin) — admin tự duyệt thử tạo KH KV (mã KH…).
 *
 * Chạy (tunnel Mongo :27018):
 *   npx tsx scripts/seed-si-tinh-pending-qa.ts
 *
 * Admin: /admin/si → Chờ duyệt → chọn «Khách sỉ tỉnh» + tick xác minh + lý do → Duyệt.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoClient, ObjectId } from "mongodb";
import { SHOP_ACCOUNTS } from "../backend/shopAuth/models.js";
import { SI_TERMS_VERSION } from "../backend/shopWholesale/policy.js";

const TAG = "QASITINH2";
const PASS = "TestSiTinh@2026";
const EMAIL = "qa.si.tinh.v2@test.local";
/** SĐT QA mới — không trùng seed cũ / KH KV */
const PHONE = "0909222888";

const FULL_NAME = "Nguyễn Văn QA Sỉ Tỉnh";
const SHOP_NAME = "Cửa hàng Cây Cảnh QA Đồng Nai";
const BUSINESS_TYPE = "Cửa hàng cây cảnh";
const TAX_CODE = "8700123456";
const PROVINCE = "Đồng Nai";
const DISTRICT = "Thành phố Biên Hòa";
const WARD = "Phường Long Bình";
const DETAIL = "45/12 Đường Nguyễn Ái Quốc";
const NOTE = "Seed QA v2 — hồ sơ đầy đủ; duyệt TINH để thử KV tự sinh mã KH…";

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
  const hash = await bcrypt.hash(PASS, 12);
  const now = new Date().toISOString();
  const id = new ObjectId().toString();

  await shopDb.collection(SHOP_ACCOUNTS).deleteMany({
    $or: [{ qaTag: TAG }, { email: EMAIL }, { phoneNorm: PHONE }, { phone: PHONE }],
  });

  await shopDb.collection(SHOP_ACCOUNTS).insertOne({
    _id: id as any,
    id,
    email: EMAIL,
    username: "qa_si_tinh_v2",
    fullName: FULL_NAME,
    phone: PHONE,
    phoneNorm: PHONE,
    passwordHash: hash,
    roles: ["customer", "si"],
    active: true,
    siIdentity: true,
    siStatus: "cho_duyet",
    siRegion: null,
    kvCustomerId: null,
    kvCustomerCode: null,
    siKvSyncStatus: null,
    applicationRevision: 1,
    siLookupResult: "new_customer",
    siCandidate: null,
    siVerification: { status: "pending" },
    siProfile: {
      fullName: FULL_NAME,
      shopName: SHOP_NAME,
      businessType: BUSINESS_TYPE,
      taxCode: TAX_CODE,
      note: NOTE,
      phone: PHONE,
      province: PROVINCE,
      district: DISTRICT,
      ward: WARD,
      detail: DETAIL,
      acceptedTermsAt: now,
      termsVersion: SI_TERMS_VERSION,
    },
    createdAt: now,
    updatedAt: now,
    qaTag: TAG,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        id,
        email: EMAIL,
        password: PASS,
        phone: PHONE,
        fullName: FULL_NAME,
        shopName: SHOP_NAME,
        businessType: BUSINESS_TYPE,
        taxCode: TAX_CODE,
        address: `${DETAIL}, ${WARD}, ${DISTRICT}, ${PROVINCE}`,
        siStatus: "cho_duyet",
        adminHint:
          "Admin → Khách sỉ → Chờ duyệt → mở hồ sơ → chọn TINH + tick xác minh + ghi lý do → Duyệt. KV kỳ vọng mã KH… + nhóm KHÁCH SỈ - TỈNH.",
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
