// Đăng ký webhook KiotViet order.update → web shop (NV sửa Đặt hàng → đơn web tự cập nhật).
// Mặc định chạy thử: kiểm tra URL công khai + liệt kê webhook hiện có, KHÔNG ghi gì lên KV.
//   npx tsx tools/kv_register_order_webhook.mts            (chạy thử)
//   npx tsx tools/kv_register_order_webhook.mts --apply    (đăng ký thật — cần duyệt)
// Không in secret / token.
import "dotenv/config";
import { MongoClient } from "mongodb";
import { fetchKvAccessToken, kvApiBase, loadKvCreds } from "../backend/services/kvApiClient.js";

const APPLY = process.argv.includes("--apply");
const TYPE = "order.update";
const URL_ARG = process.argv.find((a) => a.startsWith("--url="))?.slice(6);
const HOOK_URL = URL_ARG || "https://alohathegioichaucay.com/api/kv-webhook/orders";

const secret = String(process.env.KIOTVIET_WEBHOOK_SECRET || "").trim();
if (!secret) throw new Error("Thiếu KIOTVIET_WEBHOOK_SECRET — backend sẽ từ chối chữ ký");

// URL phải trả JSON từ backend (không phải trang 404 của Next) thì KV mới không tắt webhook.
const probe = await fetch(HOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
  signal: AbortSignal.timeout(15_000),
});
const probeText = await probe.text();
let probeJson: any = null;
try {
  probeJson = JSON.parse(probeText);
} catch {
  /* ignore */
}
console.log("probe", HOOK_URL, "HTTP", probe.status, probeJson ?? probeText.slice(0, 120));
if (probe.status !== 200 || typeof probeJson?.queued !== "number") {
  throw new Error("URL chưa trỏ tới backend mới (cần deploy trước) — dừng, không đăng ký");
}

const client = await new MongoClient(process.env.MONGO_URI || "", { serverSelectionTimeoutMS: 15000 }).connect();
try {
  const creds = await loadKvCreds(client.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db"));
  if (!creds) throw new Error("Không có cấu hình KiotViet");
  const token = await fetchKvAccessToken(creds);
  const headers = { Authorization: `Bearer ${token}`, Retailer: creds.retailer, "Content-Type": "application/json" };

  const listRes = await fetch(`${kvApiBase()}/webhooks?pageSize=100`, { headers, signal: AbortSignal.timeout(60_000) });
  const listJson: any = await listRes.json().catch(() => null);
  const hooks: any[] = Array.isArray(listJson?.data) ? listJson.data : [];
  for (const w of hooks) {
    console.log("hiện có", JSON.stringify({ id: w.id, type: w.type, url: w.url, isActive: w.isActive }));
  }
  const existing = hooks.find((w) => String(w.type).toLowerCase() === TYPE);
  if (existing) {
    console.log(`Đã có webhook ${TYPE} (id ${existing.id}) → bỏ qua`);
  } else if (!APPLY) {
    console.log(`[chạy thử] Sẽ đăng ký ${TYPE} → ${HOOK_URL}. Thêm --apply để đăng ký thật.`);
  } else {
    const res = await fetch(`${kvApiBase()}/webhooks`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        Webhook: { Type: TYPE, Url: HOOK_URL, IsActive: true, Description: "ALOHA shop sync sửa đơn", Secret: secret },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    console.log("đăng ký HTTP", res.status, json ? { id: json.id ?? json.data?.id, type: json.type ?? json.data?.type } : text.slice(0, 200));
  }
} finally {
  await client.close();
}
