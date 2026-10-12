import test from "node:test";
import assert from "node:assert/strict";
import { kvProductId, planKvIdentity, reconcileKvIdentities } from "../backend/shopCatalog/kvProductIdentity.js";
import { findByProductSlug } from "../backend/shopCatalog/catalog/publicProduct.js";

const live = { id: 43855340, code: "TKTTTS24", isActive: true };
const fixture = () => [
  { _id: "old", source: "kiotviet", id: "43855340", ma: "SP000055", webBadge: "noi_bat", webPin: 3, videos: ["old-video"], ton: 1 },
  { _id: "new", source: "kiotviet", id: "43855340", ma: "TKTTTS24", webBadge: "", videos: ["new-video"], ton: 2 },
];

test("stable KV identity chooses current code and preserves CMS metadata without adding stock", () => {
  const docs = fixture(), p = planKvIdentity(docs, live)!;
  assert.equal(p.canonical._id, "new"); assert.equal(p.aliases[0]._id, "old");
  assert.deepEqual(p.aliasCodes, ["SP000055"]);
  assert.equal(p.set.webBadge, "noi_bat"); assert.equal(p.set.webPin, 3);
  assert.deepEqual(p.set.videos, ["old-video", "new-video"]);
  assert.equal(p.set.ton, undefined); assert.equal(docs[1].ton, 2);
  assert.equal(docs[0].ma, "SP000055");
});
test("rename reuses the physical document when a new-code document does not exist", () => {
  const p = planKvIdentity(fixture().slice(0, 1), live)!;
  assert.equal(p.canonical._id, "old"); assert.equal(p.set.ma, "TKTTTS24");
  assert.deepEqual(p.aliasCodes, ["SP000055"]); assert.equal(p.aliases.length, 0);
});
test("different KV identities with the same name/unit never merge", () => {
  assert.equal(planKvIdentity([{ source: "kiotviet", id: "41381815", ma: "KTTTS" }], live), null);
  for (const id of [null, 0, -1, "test", Number.MAX_SAFE_INTEGER + 1]) assert.equal(kvProductId({ id }), "");
});
test("explicit canonical merchandising and manual visibility survive reconciliation", () => {
  const docs: any[] = fixture(); docs[1].webBadge = "uu_dai"; docs[1].webPin = 9; docs[0].hienThiWeb = false;
  const p = planKvIdentity(docs, live)!;
  assert.equal(p.set.webBadge, undefined); assert.equal(p.set.webPin, undefined); assert.equal(p.set.hienThiWeb, false);
});

function dbFixture(held = 0) {
  const docs: any[] = fixture(), writes: any[] = [];
  const col = { createIndex: async () => "index", find: () => ({ toArray: async () => docs }), findOne: async () => null,
    updateOne: async (q: any, u: any) => { writes.push({ q, u }); const doc = docs.find(d => d._id === q._id); Object.assign(doc, u.$set); for (const key of Object.keys(u.$unset || {})) delete doc[key]; } };
  const db: any = { collection: (name: string) => name === "aloha_products" ? col : { countDocuments: async () => held } };
  return { db, docs, writes };
}
test("reconciliation archives old rows, retains history, and is idempotent", async () => {
  const f = dbFixture();
  await reconcileKvIdentities(f.db, [live]);
  assert.equal(f.docs[0].ma, "SP000055"); assert.equal(f.docs[0].mergedInto, "TKTTTS24");
  assert.equal(f.docs[0].isActive, false); assert.equal(f.docs[0].hienThiWeb, false);
  assert.deepEqual(f.docs[1].kvCodeAliases, ["SP000055"]);
  assert.equal(f.docs.length, 2); assert.equal(f.writes.length, 2);
  assert.deepEqual(await reconcileKvIdentities(f.db, [live]), []); assert.equal(f.writes.length, 2);
});
test("active old-code reservations fail closed before product writes", async () => {
  const f = dbFixture(1);
  await assert.rejects(reconcileKvIdentities(f.db, [live]), /active_holds/);
  assert.equal(f.writes.length, 0);
});
test("ambiguous verified input fails closed", async () => {
  const f = dbFixture();
  await assert.rejects(reconcileKvIdentities(f.db, [live, { ...live, code: "OTHER" }]), /ambiguous/);
  assert.equal(f.writes.length, 0);
});

test("old product slug resolves the active canonical product via aliases", async () => {
  const canonical = { ma: "TKTTTS24", isActive: true, kvCodeAliases: ["SP000055"] };
  const db: any = { collection: () => ({ findOne: async (q: any) => q.$and.some((x: any) => x.kvCodeAliases === "SP000055") ? canonical : null }) };
  assert.equal((await findByProductSlug(db, "cay-kim-thuy-tung--sp000055"))?.ma, "TKTTTS24");
});
test("retired/inactive alias destinations do not bypass the storefront active filters", async () => {
  const queries: any[] = [];
  const db: any = { collection: () => ({ findOne: async (q: any) => { queries.push(q); return null; },
    find: () => ({ project() { return this; }, limit() { return this; }, toArray: async () => [] }) }) };
  assert.equal(await findByProductSlug(db, "cay--sp000055"), null);
  const alias = queries.find(q => q.$and.some((x: any) => x.kvCodeAliases));
  assert.ok(alias.$and.some((x: any) => x.mergedInto));
  assert.ok(alias.$and.some((x: any) => x.$or?.some((v: any) => v.isActive)));
});
