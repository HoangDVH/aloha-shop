/**
 * Unit-style QA for pinArrange (no Mongo) — cases A/B/C/F scope.
 * Run: node scripts/qa-merch-pin-badge-unit.cjs
 */
const assert = require("assert");

// Inline mirror of pinArrange (tsx not required for QA runner)
function normalizeWebBadge(raw) {
  const b = String(raw || "").trim();
  if (b === "ban_chay_sap_het" || b === "ban_chay") return "ban_chay_sap_het";
  if (b === "giam_gia") return "giam_gia";
  if (b === "dat_truoc") return "dat_truoc";
  if (b === "moi") return "moi";
  return "";
}

function arrangeByAbsolutePin(items, secondaryCompare, pinBadgeScope) {
  const scope = normalizeWebBadge(pinBadgeScope || "");
  const effectivePin = (p) => {
    if (!scope) return 0;
    if (normalizeWebBadge(p.webBadge) !== scope) return 0;
    const n = Math.round(Number(p.webPin));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const pinMap = new Map();
  const unpinned = [];
  for (const p of items) {
    const n = effectivePin(p);
    if (n > 0) {
      if (!pinMap.has(n)) pinMap.set(n, p);
      else unpinned.push(p);
    } else unpinned.push(p);
  }
  unpinned.sort(secondaryCompare);
  if (!pinMap.size) return unpinned;
  const out = [];
  let u = 0;
  const maxPin = Math.max(...pinMap.keys());
  for (let slot = 1; slot <= maxPin; slot++) {
    const hit = pinMap.get(slot);
    if (hit) out.push(hit);
    else if (u < unpinned.length) out.push(unpinned[u++]);
  }
  while (u < unpinned.length) out.push(unpinned[u++]);
  return out;
}

const byRev = (a, b) => (b.rev || 0) - (a.rev || 0) || a.ma.localeCompare(b.ma);
const results = [];

function check(id, title, fn) {
  try {
    fn();
    results.push({ id, title, status: "Pass" });
  } catch (e) {
    results.push({ id, title, status: "Fail", error: e.message });
  }
}

check("C", "Ghim 1 và 4 — slot 2-3 filler", () => {
  const items = [
    { ma: "A", webPin: 1, webBadge: "ban_chay_sap_het", rev: 10 },
    { ma: "B", webPin: 4, webBadge: "ban_chay_sap_het", rev: 5 },
    { ma: "U1", webPin: 0, webBadge: "ban_chay_sap_het", rev: 90 },
    { ma: "U2", webPin: 0, webBadge: "ban_chay_sap_het", rev: 80 },
    { ma: "U3", webPin: 0, webBadge: "ban_chay_sap_het", rev: 70 },
  ];
  const out = arrangeByAbsolutePin(items, byRev, "ban_chay_sap_het").map(
    (x) => x.ma
  );
  assert.deepStrictEqual(out.slice(0, 4), ["A", "U1", "U2", "B"]);
});

check("B", "Khác nhãn cùng pin 1 — không đụng trong scope bán chạy", () => {
  const items = [
    { ma: "HOT", webPin: 1, webBadge: "ban_chay_sap_het", rev: 1 },
    { ma: "NEW", webPin: 1, webBadge: "moi", rev: 99 },
    { ma: "U", webPin: 0, webBadge: "", rev: 50 },
  ];
  const out = arrangeByAbsolutePin(items, byRev, "ban_chay_sap_het").map(
    (x) => x.ma
  );
  assert.strictEqual(out[0], "HOT");
  assert.ok(out.includes("NEW"));
  assert.ok(out.indexOf("NEW") > 0); // NEW không chiếm slot 1 của bán chạy
});

check("F", "Scope rỗng — không áp ghim", () => {
  const items = [
    { ma: "P", webPin: 1, webBadge: "ban_chay_sap_het", rev: 1 },
    { ma: "Q", webPin: 0, webBadge: "", rev: 100 },
  ];
  const out = arrangeByAbsolutePin(items, byRev, "").map((x) => x.ma);
  assert.deepStrictEqual(out, ["Q", "P"]); // chỉ theo rev
});

check("N", "Sort moi theo ngày (mô phỏng)", () => {
  const items = [
    { ma: "OLD", createdAt: "2022-01-01T00:00:00.000Z" },
    { ma: "NEW", createdAt: "2026-09-16T00:00:00.000Z" },
  ];
  const sorted = [...items].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
  assert.strictEqual(sorted[0].ma, "NEW");
  assert.strictEqual(sorted[1].ma, "OLD");
});

const failed = results.filter((r) => r.status === "Fail");
console.log(JSON.stringify({ results, passed: results.length - failed.length, failed: failed.length }, null, 2));
process.exit(failed.length ? 1 : 0);
