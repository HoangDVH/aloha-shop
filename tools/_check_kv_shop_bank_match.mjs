import "dotenv/config";
import { MongoClient } from "mongodb";

const shopKvId = Number(process.env.SHOP_KV_ACCOUNT_ID || 0);
const bank = {
  bin: process.env.SHOP_BANK_BIN,
  account: process.env.SHOP_BANK_ACCOUNT,
  name: process.env.SHOP_BANK_ACCOUNT_NAME,
  bankName: process.env.SHOP_BANK_NAME,
};
const awaiting = process.env.SHOP_KIOTQR_AWAITING;

function byTail(s) {
  return String(s || "").replace(/\D/g, "").slice(-4);
}

async function token() {
  const body = new URLSearchParams({
    scopes: "PublicApi.Access",
    scope: "PublicApi.Access",
    grant_type: "client_credentials",
    client_id: process.env.KV_CLIENT_ID,
    client_secret: process.env.KV_CLIENT_SECRET,
  });
  const auth = process.env.KV_AUTH_URL || "https://id.kiotviet.vn/connect/token";
  const r = await fetch(auth, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("no token " + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

const t = await token();
const retailer = process.env.KV_RETAILER;
const api = (process.env.KV_API_URL || "https://public.kiotapi.com").replace(/\/$/, "");
const headers = {
  Authorization: "Bearer " + t,
  Retailer: retailer,
  "Content-Type": "application/json",
};

const ba = await fetch(api + "/bankaccounts", { headers }).then((r) => r.json());
const accounts = Array.isArray(ba?.data) ? ba.data : Array.isArray(ba) ? ba : [];
const mapped = accounts.map((a) => ({
  id: a.id ?? a.Id,
  bank: a.bankName || a.BankName || a.bank || "",
  account: a.account || a.Account || a.accountNumber || a.BankAccount || "",
  holder: a.accountName || a.AccountName || a.holder || "",
  rawKeys: Object.keys(a).slice(0, 20),
}));

const selected = mapped.find((a) => Number(a.id) === shopKvId);
const shopTail = byTail(bank.account);
const matchByStk = mapped.filter(
  (a) => byTail(a.account) === shopTail || String(a.account).includes(String(bank.account || ""))
);
const vcb1233 = mapped.filter((a) => byTail(a.account) === "1233" || String(a.account).includes("9931101233"));

console.log(
  JSON.stringify(
    {
      shopEnv: {
        SHOP_KV_ACCOUNT_ID: shopKvId,
        SHOP_BANK: bank,
        SHOP_KIOTQR_AWAITING: awaiting,
        KV_RETAILER: retailer,
      },
      kvBankAccounts: mapped,
      selectedByShopKvAccountId: selected || null,
      accountsMatchingShopStk: matchByStk,
      vcbAccountInImage: vcb1233,
      stkMatchSelected: selected ? byTail(selected.account) === shopTail : false,
    },
    null,
    2
  )
);

const uri = process.env.MONGO_URI;
const dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
const cols = (await db.listCollections().toArray()).map((c) => c.name);
const orderCols = cols.filter((n) => /order/i.test(n));

let recent = [];
let usedCol = null;
for (const name of orderCols) {
  const sample = await db
    .collection(name)
    .find({
      $or: [
        { paymentMethod: /transfer/i },
        { method: /transfer/i },
        { kvInvoiceCode: { $exists: true, $ne: null } },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  if (sample.length) {
    usedCol = name;
    recent = sample;
    break;
  }
}

const enriched = [];
for (const o of recent) {
  const id = o.kvInvoiceId;
  let inv = null;
  if (id != null && id !== "") {
    try {
      const r = await fetch(api + "/invoices/" + id + "?includePayment=true", { headers });
      if (r.ok) inv = await r.json();
    } catch {
      /* ignore */
    }
  }
  const addInfo = String(o.kvInvoiceCode || o.paymentCode || "").trim() || null;
  const invPayments = inv?.payments || inv?.Payments || [];
  const invAccountId =
    invPayments[0]?.accountId ?? inv?.accountId ?? inv?.AccountId ?? null;
  enriched.push({
    orderCode: o.code || o.orderCode,
    paymentCode: o.paymentCode || null,
    kvInvoiceCode: o.kvInvoiceCode || null,
    kvInvoiceMode: o.kvInvoiceMode || null,
    shopQrAddInfoWouldBe: addInfo,
    contentUsesHdCode: !!(o.kvInvoiceCode && addInfo === String(o.kvInvoiceCode).trim()),
    kvInvoice: inv
      ? {
          code: inv.code || inv.Code,
          total: inv.total ?? inv.Total,
          totalPayment: inv.totalPayment ?? inv.TotalPayment,
          status: inv.statusValue || inv.status,
          paymentAccountId: invAccountId,
          payments: invPayments.slice(0, 3).map((p) => ({
            method: p.method,
            amount: p.amount,
            accountId: p.accountId,
            bankAccount: p.bankAccount,
            status: p.statusValue || p.status,
          })),
        }
      : null,
    codeMatchInvoice: inv
      ? String(inv.code || inv.Code || "") === String(o.kvInvoiceCode || "")
      : null,
  });
}

console.log(
  JSON.stringify(
    {
      orderCollection: usedCol,
      orderCols,
      recentOrdersCheck: enriched,
    },
    null,
    2
  )
);
await client.close();
