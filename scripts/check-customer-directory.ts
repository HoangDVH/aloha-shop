/** Read-only check of the running API against the configured customer database.
 * Run from the project root: node --import tsx scripts/check-customer-directory.ts
 * No customer data or access token is printed or saved.
 */
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import jwt from "jsonwebtoken";
dotenv.config({ quiet: true });

async function main() {
  const shop = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017", { serverSelectionTimeoutMS: 5000 });
  const ops = new MongoClient(process.env.MONGO_URI_OPS || process.env.MONGO_URI || "mongodb://127.0.0.1:27017", { serverSelectionTimeoutMS: 5000 });
  const base = process.argv.includes("--direct") ? "http://127.0.0.1:3001" : "http://localhost:3002";
  try {
    await Promise.all([shop.connect(), ops.connect()]);
    const dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
    const admin = await ops.db(process.env.OPS_DB_NAME || dbName).collection("aloha_users").findOne(
      { role: "manager", active: { $ne: false }, approvalStatus: { $ne: "rejected" } },
      { projection: { _id: 1, username: 1 } });
    if (!admin) throw new Error("No active local manager available for read-only API verification");
    const token = jwt.sign({ sub: String(admin._id), username: admin.username, role: "manager" },
      process.env.JWT_ACCESS_SECRET || "aloha-dev-access-change-me", { expiresIn: "10m" });
    const all = await shop.db(dbName).collection("aloha_shop_accounts").find({}, { projection: {
      _id: 1, roles: 1, siRegion: 1, siStatus: 1, ctvStatus: 1, active: 1,
      fullName: 1, email: 1, phone: 1, ctvCode: 1, createdAt: 1,
    } }).sort({ createdAt: -1 }).toArray();
    const directory = all.filter(a => a.roles?.some((r: string) => ["customer", "si", "ctv"].includes(r)));
    const cases: Array<{ label: string; params: Record<string, string>; expected: typeof all }> = [];
    const add = (label: string, params: Record<string, string>, predicate: (a: any) => boolean) => cases.push({ label, params, expected: directory.filter(predicate) });
    const types: Record<string, (a: any) => boolean> = {
      all: () => true, retail: a => !a.roles.includes("si"), wholesale: a => a.roles.includes("si"),
      HCM: a => a.roles.includes("si") && a.siRegion === "HCM",
      TINH: a => a.roles.includes("si") && a.siRegion === "TINH",
      unassigned: a => a.roles.includes("si") && !["HCM", "TINH"].includes(a.siRegion),
    };
    const affiliates: Record<string, (a: any) => boolean> = {
      all: () => true, member: a => a.roles.includes("ctv"), none: a => !a.roles.includes("ctv"),
      ...Object.fromEntries(["active", "cho_duyet", "khoa", "tu_choi"].map(s => [s, (a: any) => a.roles.includes("ctv") && a.ctvStatus === s])),
    };
    for (const [type, predicate] of Object.entries(types)) add(`type:${type}`, { customerType: type }, predicate);
    for (const [affiliate, predicate] of Object.entries(affiliates)) add(`affiliate:${affiliate}`, { affiliate }, predicate);
    for (const status of ["all", "active", "cho_duyet", "khoa", "tu_choi"]) add(`wholesale:${status}`, { wholesaleStatus: status }, a => status === "all" || a.roles.includes("si") && a.siStatus === status);
    for (const state of ["all", "active", "locked"]) add(`account:${state}`, { accountState: state }, a => state === "all" || (state === "active" ? a.active !== false : a.active === false));
    const pending = (a: any) => a.roles.includes("si") && a.siStatus === "cho_duyet" || a.roles.includes("ctv") && a.ctvStatus === "cho_duyet";
    add("pending", { pending: "1" }, pending);
    for (const [type, typeMatch] of Object.entries(types)) {
      add(`pending+${type}`, { pending: "1", customerType: type }, a => pending(a) && typeMatch(a));
      for (const [affiliate, ctvMatch] of Object.entries(affiliates)) add(`${type}+${affiliate}`, { customerType: type, affiliate }, a => typeMatch(a) && ctvMatch(a));
    }
    for (const field of ["fullName", "email", "phone", "ctvCode"]) {
      const sample = directory.find(a => typeof a[field] === "string" && a[field].length > 2);
      if (sample) {
        const q = String(sample[field]).slice(0, 8).toLowerCase();
        add(`search:${field}`, { q }, a => ["fullName", "email", "phone", "ctvCode"].some(k => String(a[k] || "").toLowerCase().includes(q)));
        add(`search:${field}+HCM`, { q, customerType: "HCM" }, a => types.HCM(a) && ["fullName", "email", "phone", "ctvCode"].some(k => String(a[k] || "").toLowerCase().includes(q)));
      }
    }
    add("search:literal-special-characters", { q: ".*[]" }, a => ["fullName", "email", "phone", "ctvCode"].some(k => String(a[k] || "").includes(".*[]")));
    const get = async (path: string) => {
      const response = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
      return { status: response.status, body: await response.json() };
    };
    const results: Array<Record<string, unknown>> = [];
    for (const c of cases) {
      const expectedIds = c.expected.map(a => String(a._id)).sort();
      const { status, body } = await get(`/api/shop/admin/accounts?${new URLSearchParams({ scope: "directory", limit: "200", ...c.params })}`);
      const actualIds = (body.items || []).map((a: any) => a.id).sort();
      results.push({ check: c.label, pass: status === 200 && body.total === expectedIds.length && JSON.stringify(actualIds) === JSON.stringify(expectedIds), expected: expectedIds.length, actual: body.total, status });
    }
    for (const type of ["all", "retail", "HCM", "TINH"]) {
      const expected = directory.filter(types[type]); const collected: string[] = [];
      let countsMatch = true;
      for (let page = 1; page <= Math.max(1, Math.ceil(expected.length / 7)); page++) {
        const { status, body } = await get(`/api/shop/admin/accounts?${new URLSearchParams({ scope: "directory", customerType: type, page: String(page), limit: "7" })}`);
        countsMatch &&= status === 200 && body.total === expected.length && body.items.length <= 7;
        collected.push(...(body.items || []).map((a: any) => a.id));
      }
      results.push({ check: `pagination:${type}`, pass: countsMatch && JSON.stringify(collected.sort()) === JSON.stringify(expected.map(a => String(a._id)).sort()) });
    }
    const segments = await get("/api/shop/admin/accounts/segments");
    const expectedSegments = { total: directory.length, retail: directory.filter(types.retail).length, HCM: directory.filter(types.HCM).length,
      TINH: directory.filter(types.TINH).length, unassigned: directory.filter(types.unassigned).length,
      affiliates: directory.filter(affiliates.member).length, pending: directory.filter(pending).length };
    results.push({ check: "segment-counts", pass: segments.status === 200 && Object.entries(expectedSegments).every(([k,v]) => segments.body[k] === v), status: segments.status });
    for (const key of ["customerType", "affiliate", "wholesaleStatus", "accountState"]) {
      const { status } = await get(`/api/shop/admin/accounts?scope=directory&${key}=invalid`);
      results.push({ check: `reject-invalid:${key}`, pass: status === 400, status });
    }
    console.log(JSON.stringify({ base, passed: results.filter(r => r.pass).length, total: results.length, counts: expectedSegments, failures: results.filter(r => !r.pass) }, null, 2));
    if (results.some(r => !r.pass)) process.exitCode = 1;
  } finally { await Promise.all([shop.close(), ops.close()]); }
}
main().catch(error => { console.error(error.name, error.message); process.exitCode = 1; });
