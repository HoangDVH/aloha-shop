import { MongoClient } from "mongodb";
import { resolveShopPaymentQrForOrder } from "../backend/shopOrders/bankConfig.ts";

const c = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
await c.connect();
const db = c.db("aloha_shop_db");
const o = await db.collection("aloha_shop_orders").findOne({ kvInvoiceCode: "HD022053" });
if (!o) {
  console.log("NO_ORDER");
  process.exit(0);
}
console.log("order", o.code, "hadCache", !!o.kiotvietQr);
const qr = await resolveShopPaymentQrForOrder(o, db);
console.log(
  JSON.stringify(
    {
      addInfo: qr.addInfo,
      kovCode: qr.kovCode,
      qrKind: qr.qrKind,
      hasQrUrl: !!qr.qrUrl,
    },
    null,
    2
  )
);
const o2 = await db.collection("aloha_shop_orders").findOne({ code: o.code });
console.log(
  "saved",
  o2?.kiotvietQr
    ? { kov: o2.kiotvietQr.kovCode, tc: o2.kiotvietQr.transferContent }
    : null
);
await c.close();
