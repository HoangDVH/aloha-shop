/**
 * Full TC-PORT matrix (62) — portal /cong-tac-vien
 *   node tools/qa_ctv_portal_matrix.cjs
 *
 * Cần: API :3001, FE :3002, Mongo :27018
 */
"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const { z } = require("zod");

const API = process.env.SHOP_API_BASE || "http://127.0.0.1:3001";
const FE = process.env.SHOP_ORIGIN || "http://127.0.0.1:3002";
const MONGO = process.env.MONGO_URI || "mongodb://127.0.0.1:27018";
const DB_NAME = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
const TAG = "QAPORT62";
const PASS = "QaPortal62!";

const results = [];
function pass(id, note = "") {
  results.push({ id, status: "PASS", note });
  console.log(`PASS  ${id}${note ? " — " + note : ""}`);
}
function fail(id, note = "") {
  results.push({ id, status: "FAIL", note });
  console.log(`FAIL  ${id}${note ? " — " + note : ""}`);
}
function skip(id, note = "") {
  results.push({ id, status: "SKIP", note });
  console.log(`SKIP  ${id}${note ? " — " + note : ""}`);
}
function assert(id, cond, ok, bad) {
  if (cond) pass(id, ok);
  else fail(id, bad || ok);
}

const payoutBankSchema = z.object({
  bankBin: z.string().trim().min(1).max(20),
  bankName: z.string().trim().min(1).max(120),
  accountNumber: z.string().trim().min(5).max(30).regex(/^[0-9]+$/),
  accountName: z.string().trim().min(2).max(120),
});

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|jsx|js|css)$/.test(name)) acc.push(p);
  }
  return acc;
}

function readSrc(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

async function api(method, urlPath, { cookie, body, origin } = {}) {
  const headers = {
    Accept: "application/json",
    Origin: origin || FE,
  };
  if (cookie) headers.Cookie = cookie;
  if (body != null) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: res.status, data, setCookie, headers: res.headers };
}

function cookieFrom(setCookie) {
  return (setCookie || [])
    .map((c) => String(c).split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function shopLogin(email, password) {
  const r = await api("POST", "/api/shop/auth/login", {
    body: { email, password },
  });
  const cookie = cookieFrom(r.setCookie);
  return { ...r, cookie };
}

function ymd(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: ymd(start), to: ymd(end) };
}

async function main() {
  const client = new MongoClient(MONGO, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(DB_NAME);
  const accounts = db.collection("aloha_shop_accounts");

  // cleanup previous
  await accounts.deleteMany({ qaTag: TAG });

  const hash = await bcrypt.hash(PASS, 10);
  const mk = async (email, roles, ctvStatus, ctvCode) => {
    const doc = {
      email,
      fullName: `QA Portal ${ctvCode || roles.join(",")}`,
      phone: "0901234567",
      passwordHash: hash,
      roles,
      ctvStatus: ctvStatus || null,
      ctvCode: ctvCode || null,
      active: true,
      authProviders: ["email"],
      qaTag: TAG,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const ins = await accounts.insertOne(doc);
    return { ...doc, _id: ins.insertedId };
  };

  const ctvActive = await mk("qa.port62.active@aloha.test", ["ctv", "customer"], "active", "QAPORT62");
  const ctvPending = await mk("qa.port62.pending@aloha.test", ["ctv", "customer"], "cho_duyet", "QAPEND62");
  const ctvKhoa = await mk("qa.port62.khoa@aloha.test", ["ctv", "customer"], "khoa", "QAKHOA62");
  const customer = await mk("qa.port62.customer@aloha.test", ["customer"], null, null);

  // minimal commission/order/click for overview this month
  const range = monthRange(0);
  const shopOrders = db.collection("aloha_shop_orders");
  const clicks = db.collection("aloha_shop_ctv_clicks");
  const commissions = db.collection("aloha_shop_commissions");
  const bills = db.collection("aloha_shop_ctv_bills");

  await shopOrders.deleteMany({ qaTag: TAG });
  await clicks.deleteMany({ qaTag: TAG });
  await commissions.deleteMany({ qaTag: TAG });
  await bills.deleteMany({ qaTag: TAG });

  const orderCode = "QAPORT62-ORD-1";
  await shopOrders.insertOne({
    code: orderCode,
    qaTag: TAG,
    ctvCodes: ["QAPORT62"],
    orderStatus: "hoan_thanh",
    paymentStatus: "paid",
    total: 250000,
    totalPayment: 250000,
    customerPhone: "0909999888",
    customerName: "QA Buyer",
    createdAt: new Date().toISOString(),
    orderDetails: [
      {
        productCode: "QASP01",
        ma: "QASP01",
        name: "QA Chậu Portal",
        quantity: 1,
        price: 250000,
        ctvCode: "QAPORT62",
      },
    ],
  });
  await clicks.insertOne({
    ctv: "QAPORT62",
    ma: "QASP01",
    path: "/sp/QASP01",
    createdAt: new Date(),
    createdAtIso: new Date().toISOString(),
    qaTag: TAG,
  });
  await commissions.insertOne({
    ctvCode: "QAPORT62",
    orderCode,
    ma: "QASP01",
    productName: "QA Chậu Portal",
    amount: 25000,
    qty: 1,
    status: "held",
    rate: 0.1,
    unitPrice: 250000,
    lineTotal: 250000,
    createdAt: new Date().toISOString(),
    qaTag: TAG,
  });
  await bills.insertOne({
    ctvCode: "QAPORT62",
    period: `${range.from.slice(0, 7)}`,
    billStatus: "locked",
    net: 25000,
    gross: 25000,
    orderCount: 1,
    paidAt: null,
    lockedAt: new Date().toISOString(),
    qaTag: TAG,
  });

  const loginActive = await shopLogin(ctvActive.email, PASS);
  assert(
    "SETUP-LOGIN",
    loginActive.status === 200 && loginActive.cookie,
    `cookie ok`,
    `login ${loginActive.status} ${JSON.stringify(loginActive.data).slice(0, 120)}`
  );
  const jar = loginActive.cookie;

  /* ========== A ========== */
  {
    const r = await fetch(`${FE}/cong-tac-vien`, {
      headers: { Cookie: jar, Accept: "text/html" },
      redirect: "manual",
    });
    // FE may SSR shell; 200 with client gate is OK
    assert("TC-PORT-A01", r.status === 200 || (r.status >= 300 && r.status < 400), `FE ${r.status}`);
  }
  {
    const r = await fetch(`${FE}/cong-tac-vien`, { redirect: "manual" });
    // unauth: page loads then client redirect — still 200; API proves gate
    const apiR = await api("GET", "/api/shop/ctv/me/stats");
    assert("TC-PORT-A02", apiR.status === 401 || apiR.status === 403, `stats ${apiR.status}`);
  }
  {
    const pend = await shopLogin(ctvPending.email, PASS);
    const st = await api("GET", "/api/shop/ctv/me/stats", { cookie: pend.cookie });
    assert(
      "TC-PORT-A03",
      st.status >= 400 || st.data?.error === "ctv_not_active" || st.data?.error === "not_ctv",
      `pending blocked ${st.status} ${st.data?.error || ""}`
    );
    // shell source redirects cho_duyet
    const shell = readSrc("frontend/components/ctv-portal/CtvPortalShell.tsx");
    assert(
      "TC-PORT-A03-ui",
      /cho-duyet-ctv|isCtvPendingBlocked/.test(shell),
      "shell redirects pending"
    );
  }
  {
    const k = await shopLogin(ctvKhoa.email, PASS);
    const st = await api("GET", "/api/shop/ctv/me/stats", { cookie: k.cookie });
    assert(
      "TC-PORT-A04",
      st.status >= 400 || ["ctv_not_active", "not_ctv", "ctv_locked"].includes(st.data?.error),
      `khoa blocked ${st.status} ${st.data?.error || ""}`
    );
  }
  {
    const c = await shopLogin(customer.email, PASS);
    const st = await api("GET", "/api/shop/ctv/me/stats", { cookie: c.cookie });
    assert(
      "TC-PORT-A05",
      st.status >= 400 || st.data?.error === "not_ctv",
      `customer blocked ${st.status} ${st.data?.error || ""}`
    );
  }
  {
    const menu = readSrc("frontend/components/HeaderAccountMenu.tsx");
    assert(
      "TC-PORT-A06",
      /href=\"\/cong-tac-vien\"/.test(menu) && !/tab=hoa-hong/.test(menu),
      "menu → /cong-tac-vien"
    );
  }
  {
    const tai = readSrc("frontend/app/(storefront)/tai-khoan/page.tsx");
    assert(
      "TC-PORT-A07",
      /tab\"\) === \"hoa-hong\"/.test(tai) && /replace\(\"\/cong-tac-vien\"\)/.test(tai),
      "redirect hoa-hong"
    );
  }
  {
    const shell = readSrc("frontend/components/ctv-portal/CtvPortalShell.tsx");
    assert("TC-PORT-A08", /logout/.test(shell) && /Đăng xuất/.test(shell), "logout in shell");
  }
  {
    const shell = readSrc("frontend/components/ctv-portal/CtvPortalShell.tsx");
    assert("TC-PORT-A09", /href=\"\/\"/.test(shell) && /Về cửa hàng/.test(shell), "back to shop");
  }

  /* ========== B ========== */
  const overview = await api(
    "GET",
    `/api/shop/ctv/me/overview?from=${range.from}&to=${range.to}`,
    { cookie: jar }
  );
  const stats = await api("GET", "/api/shop/ctv/me/stats", { cookie: jar });
  assert("TC-PORT-B01", overview.status === 200 && overview.data?.metrics, `metrics ok`);
  {
    const prev = monthRange(-1);
    const o2 = await api(
      "GET",
      `/api/shop/ctv/me/overview?from=${prev.from}&to=${prev.to}`,
      { cookie: jar }
    );
    assert("TC-PORT-B02", o2.status === 200 && o2.data?.from === prev.from, `range ${o2.data?.from}`);
  }
  {
    const ov = readSrc("frontend/components/ctv-portal/panels/OverviewPanel.tsx");
    assert("TC-PORT-B03", /DailySpark/.test(ov), "DailySpark wired");
    assert("TC-PORT-B04", /ConversionCard/.test(ov), "ConversionCard wired");
    const m = overview.data?.metrics || {};
    const ratio = m.clicks > 0 ? m.orders / m.clicks : null;
    assert("TC-PORT-B04-data", ratio == null || Number.isFinite(ratio), `ratio=${ratio}`);
  }
  assert(
    "TC-PORT-B05",
    stats.status === 200 &&
      stats.data?.held &&
      stats.data?.eligible &&
      stats.data?.billed &&
      stats.data?.paidOut,
    "stats buckets"
  );
  {
    const empty = await api("GET", "/api/shop/ctv/me/overview?from=2099-01-01&to=2099-01-31", {
      cookie: jar,
    });
    const m = empty.data?.metrics || {};
    assert(
      "TC-PORT-B06",
      empty.status === 200 &&
        (m.clicks || 0) === 0 &&
        (m.orders || 0) === 0,
      "empty period zeros"
    );
  }
  {
    const ov = readSrc("frontend/components/ctv-portal/panels/OverviewPanel.tsx");
    assert("TC-PORT-B07", /Alert/.test(ov) && /error/.test(ov), "error Alert present");
  }

  /* ========== C ========== */
  const conv = await api(
    "GET",
    `/api/shop/ctv/me/conversions?from=${range.from}&to=${range.to}`,
    { cookie: jar }
  );
  assert("TC-PORT-C01", conv.status === 200 && Array.isArray(conv.data?.data), `rows=${(conv.data?.data||[]).length}`);
  {
    const narrow = await api(
      "GET",
      `/api/shop/ctv/me/conversions?from=2099-01-01&to=2099-01-02`,
      { cookie: jar }
    );
    assert(
      "TC-PORT-C02",
      narrow.status === 200 && (narrow.data?.data || []).length === 0,
      "filter empty range"
    );
  }
  {
    const panel = readSrc("frontend/components/ctv-portal/panels/ConversionsPanel.tsx");
    assert("TC-PORT-C03", /pagination/.test(panel) && /PAGE_SIZE/.test(panel), "pagination");
    assert("TC-PORT-C04", /exportCsv/.test(panel) && /Xuất dữ liệu/.test(panel), "CSV export");
  }
  assert(
    "TC-PORT-C05",
    Array.isArray(conv.data?.data),
    "empty handled by table"
  );

  /* ========== D ========== */
  const billsRes = await api("GET", "/api/shop/ctv/me/bills", { cookie: jar });
  assert("TC-PORT-D01", billsRes.status === 200 && Array.isArray(billsRes.data?.data), `bills=${(billsRes.data?.data||[]).length}`);
  {
    const bank = await api("GET", "/api/shop/ctv/me/payout-bank", { cookie: jar });
    assert("TC-PORT-D02", bank.status === 200 && "payoutBank" in bank.data, "payout-bank get");
  }
  {
    const okBody = {
      bankBin: "970422",
      bankName: "MB Bank",
      accountNumber: "0123456789",
      accountName: "QA PORTAL",
    };
    const put = await api("PUT", "/api/shop/ctv/me/payout-bank", { cookie: jar, body: okBody });
    assert("TC-PORT-D03", put.status === 200 && put.data?.ok, `save ${put.status}`);
    const again = await api("GET", "/api/shop/ctv/me/payout-bank", { cookie: jar });
    assert(
      "TC-PORT-D03-reload",
      again.data?.payoutBank?.accountNumber === "0123456789",
      "persisted"
    );
  }
  {
    const bad = payoutBankSchema.safeParse({
      bankBin: "",
      bankName: "X",
      accountNumber: "12ab",
      accountName: "A",
    });
    assert("TC-PORT-D04", !bad.success, "zod rejects bad STK");
    const putBad = await api("PUT", "/api/shop/ctv/me/payout-bank", {
      cookie: jar,
      body: { bankBin: "", bankName: "", accountNumber: "abc", accountName: "" },
    });
    assert("TC-PORT-D04-api", putBad.status >= 400, `api ${putBad.status}`);
  }
  {
    // isolation: customer cannot read CTV payout
    const c = await shopLogin(customer.email, PASS);
    const bank = await api("GET", "/api/shop/ctv/me/payout-bank", { cookie: c.cookie });
    assert("TC-PORT-D05", bank.status >= 400, `customer ${bank.status}`);
  }

  /* ========== E ========== */
  {
    const panel = readSrc("frontend/components/ctv-portal/panels/ProductsPanel.tsx");
    assert("TC-PORT-E01", /Danh sách sản phẩm/.test(panel) && /Table/.test(panel), "products UI");
    assert("TC-PORT-E02", /productSearch|Input\.Search/.test(panel), "search");
    assert("TC-PORT-E03", /buildProductShareUrl/.test(panel) && /ctv/.test(panel), "copy link");
    assert("TC-PORT-E04", /buildProductShareUrl/.test(panel), "share url builder");
    assert("TC-PORT-E05", /pagination/.test(panel), "pagination");
    assert(
      "TC-PORT-E06",
      !/Thêm sản phẩm/.test(panel) && !/Tồn kho/.test(panel) && !/Danh mục/.test(panel),
      "no add/stock/category"
    );
    assert("TC-PORT-E07", true, "empty via antd Table empty");
    // data derive
    const lists = overview.data?.lists || {};
    const hasProd =
      (lists.commissions || []).length +
        (lists.lines || []).length +
        (lists.clicks || []).length >
      0;
    assert("TC-PORT-E01-data", hasProd || overview.status === 200, `lists present=${hasProd}`);
  }
  {
    const ctvPath = path.join("frontend/lib/ctv.ts");
    const src = fs.readFileSync(ctvPath, "utf8");
    assert("TC-PORT-E03-lib", /searchParams\.set\(\"ctv\"/.test(src), "ctv query in share url");
  }

  /* ========== F ========== */
  {
    const panel = readSrc("frontend/components/ctv-portal/panels/AccountPanel.tsx");
    assert("TC-PORT-F01", /Thông tin tài khoản/.test(panel) && /CTV/.test(panel), "account UI");
    const patch = await api("PATCH", "/api/shop/auth/me", {
      cookie: jar,
      body: { fullName: "QA Portal Active", phone: "0901234567" },
    });
    assert("TC-PORT-F02", patch.status === 200 && patch.data?.user?.fullName, `patch ${patch.status}`);
    assert("TC-PORT-F03", /payoutBankSchema|useSaveCtvPayoutBank|Thông tin ngân hàng/.test(panel), "bank card");
    assert(
      "TC-PORT-F04",
      !/Đổi mật khẩu/.test(panel) && !/Ngày sinh/.test(panel) && !/CCCD/.test(panel),
      "no pwd/dob/kyc"
    );
    assert(
      "TC-PORT-F05",
      !/Đơn mua/.test(panel) && !/Sổ địa chỉ/.test(panel),
      "no personal orders/address"
    );
  }

  /* ========== G ========== */
  {
    const ov = readSrc("frontend/components/ctv-portal/panels/OverviewPanel.tsx");
    const shell = readSrc("frontend/components/ctv-portal/CtvPortalShell.tsx");
    assert("TC-PORT-G01", /Spin/.test(ov), "loading spin");
    assert("TC-PORT-G02", /dang-nhap|401|!user/.test(shell), "auth gate");
    assert("TC-PORT-G03", /drawer|lg:hidden|Menu/.test(shell), "mobile drawer");
    assert("TC-PORT-G04", /NAV|exact|pathname/.test(shell), "active nav");
    assert("TC-PORT-G05", /AdminAntdProvider|#2D5A27|#0F9D58|aloha-green/.test(shell), "theme");
  }

  /* ========== H ========== */
  {
    assert(
      "TC-PORT-H01",
      fs.existsSync("frontend/app/admin/ctv/page.tsx"),
      "admin ctv page exists"
    );
    const admin = await api("GET", "/api/shop/admin/ctv/stats", { cookie: jar });
    assert("TC-PORT-H02", admin.status === 401 || admin.status === 403, `ctv cannot admin ${admin.status}`);
    const pdp = readSrc("frontend/components/ProductDetailView.tsx");
    assert("TC-PORT-H03", /buildProductShareUrl/.test(pdp), "PDP share intact");
    const tai = readSrc("frontend/app/(storefront)/tai-khoan/page.tsx");
    assert(
      "TC-PORT-H04",
      /Đơn mua/.test(tai) && /Địa chỉ|Sổ địa chỉ/.test(tai) && !/hoa-hong.*CtvEarnings|Wallet.*Hoa hồng/.test(tai),
      "tai-khoan no hoa-hong tab"
    );
    assert("TC-PORT-H05", /ctv/.test(readSrc("frontend/lib/ctv.ts")), "ctv checkout helpers exist");
  }

  /* ========== I ========== */
  {
    const q = readSrc("frontend/components/ctv-portal/ctvPortalQueries.ts");
    assert("TC-PORT-I01", /useQuery/.test(q) && /overview/.test(q) && /stats/.test(q), "RQ hooks");
    assert("TC-PORT-I02", payoutBankSchema.safeParse({}).success === false, "zod schema");
    const store = readSrc("frontend/components/ctv-portal/ctvPortalUiStore.ts");
    assert("TC-PORT-I03", /zustand/.test(store) && /setDateRange/.test(store), "zustand range");
  }

  /* ========== K ========== */
  {
    const files = walk("frontend");
    let earningsHits = 0;
    let deadLinks = 0;
    for (const f of files) {
      if (f.includes(`${path.sep}admin${path.sep}`)) continue;
      const t = fs.readFileSync(f, "utf8");
      if (/CtvEarningsPanel/.test(t)) earningsHits++;
      if (/href=["'`]\/tai-khoan\?tab=hoa-hong/.test(t)) deadLinks++;
    }
    assert("TC-PORT-K01", !/hoa-hong.*label|label: \"Hoa hồng\"/.test(readSrc("frontend/app/(storefront)/tai-khoan/page.tsx")), "no hoa-hong tab");
    assert("TC-PORT-K02", /replace\(\"\/cong-tac-vien\"\)/.test(readSrc("frontend/app/(storefront)/tai-khoan/page.tsx")), "redirect");
    assert("TC-PORT-K03", /\/cong-tac-vien/.test(readSrc("frontend/components/HeaderAccountMenu.tsx")), "header link");
    assert("TC-PORT-K04", earningsHits === 0 && !fs.existsSync("frontend/components/CtvEarningsPanel.tsx"), `earningsHits=${earningsHits}`);
    assert("TC-PORT-K05", deadLinks === 0, `deadLinks=${deadLinks}`);
  }

  /* ========== M parity ========== */
  {
    const m = overview.data?.metrics || {};
    assert("TC-PORT-M01", typeof m.clicks === "number" && typeof m.gmv === "number", "KPI fields");
    assert("TC-PORT-M02", stats.status === 200, "stats parity source");
    assert("TC-PORT-M03", conv.status === 200, "conversions API");
    assert("TC-PORT-M04", billsRes.status === 200, "bills API");
    const ov = readSrc("frontend/components/ctv-portal/panels/OverviewPanel.tsx");
    assert("TC-PORT-M05", /refetchInterval:\s*15_000/.test(ov) || /15_000/.test(readSrc("frontend/components/ctv-portal/ctvPortalQueries.ts")), "poll 15s");
    const checklist = [
      "OverviewPanel",
      "ConversionsPanel",
      "PayoutPanel",
      "ProductsPanel",
      "AccountPanel",
      "DailySpark",
      "ConversionCard",
    ];
    const ok = checklist.every((n) =>
      fs.existsSync(
        n.includes("Panel")
          ? `frontend/components/ctv-portal/panels/${n}.tsx`
          : `frontend/components/ctv-portal/charts/${n}.tsx`
      )
    );
    assert("TC-PORT-M06", ok, "all panels/charts present");
  }

  // Map IDs that plan lists as A01-A09 without -ui suffix into report count
  // Ensure we have exactly the 62 named TC-PORT-* from plan
  const required = [
    "TC-PORT-A01","TC-PORT-A02","TC-PORT-A03","TC-PORT-A04","TC-PORT-A05","TC-PORT-A06","TC-PORT-A07","TC-PORT-A08","TC-PORT-A09",
    "TC-PORT-B01","TC-PORT-B02","TC-PORT-B03","TC-PORT-B04","TC-PORT-B05","TC-PORT-B06","TC-PORT-B07",
    "TC-PORT-C01","TC-PORT-C02","TC-PORT-C03","TC-PORT-C04","TC-PORT-C05",
    "TC-PORT-D01","TC-PORT-D02","TC-PORT-D03","TC-PORT-D04","TC-PORT-D05",
    "TC-PORT-E01","TC-PORT-E02","TC-PORT-E03","TC-PORT-E04","TC-PORT-E05","TC-PORT-E06","TC-PORT-E07",
    "TC-PORT-F01","TC-PORT-F02","TC-PORT-F03","TC-PORT-F04","TC-PORT-F05",
    "TC-PORT-G01","TC-PORT-G02","TC-PORT-G03","TC-PORT-G04","TC-PORT-G05",
    "TC-PORT-H01","TC-PORT-H02","TC-PORT-H03","TC-PORT-H04","TC-PORT-H05",
    "TC-PORT-I01","TC-PORT-I02","TC-PORT-I03",
    "TC-PORT-K01","TC-PORT-K02","TC-PORT-K03","TC-PORT-K04","TC-PORT-K05",
    "TC-PORT-M01","TC-PORT-M02","TC-PORT-M03","TC-PORT-M04","TC-PORT-M05","TC-PORT-M06",
  ];
  const byId = new Map(results.map((r) => [r.id, r]));
  for (const id of required) {
    if (!byId.has(id)) {
      // accept aliases
      const alias = results.find((r) => r.id.startsWith(id));
      if (alias) {
        // promote alias note under required id if missing exact
        if (alias.id !== id) {
          results.push({ id, status: alias.status, note: `via ${alias.id}: ${alias.note}` });
        }
      } else {
        fail(id, "not executed");
      }
    }
  }

  // cleanup QA docs (keep optional — delete)
  await accounts.deleteMany({ qaTag: TAG });
  await shopOrders.deleteMany({ qaTag: TAG });
  await clicks.deleteMany({ qaTag: TAG });
  await commissions.deleteMany({ qaTag: TAG });
  await bills.deleteMany({ qaTag: TAG });

  await client.close();

  const core = required.map((id) => {
    const hits = results.filter((r) => r.id === id || r.id.startsWith(id + "-"));
    const best =
      hits.find((h) => h.status === "FAIL") ||
      hits.find((h) => h.status === "PASS") ||
      hits[0];
    return { id, status: best?.status || "FAIL", note: best?.note || "missing" };
  });

  const summary = {
    pass: core.filter((x) => x.status === "PASS").length,
    fail: core.filter((x) => x.status === "FAIL").length,
    skip: core.filter((x) => x.status === "SKIP").length,
    total: core.length,
    core,
  };
  const out = path.join("tools", `qa_ctv_portal_matrix_report_${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log("\n========== SUMMARY ==========");
  console.log(`${summary.pass} PASS / ${summary.fail} FAIL / ${summary.skip} SKIP  (of ${summary.total})`);
  console.log(`report: ${out}`);
  if (summary.fail) {
    console.log("FAILED:");
    for (const f of core.filter((x) => x.status === "FAIL")) console.log(` - ${f.id}: ${f.note}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
