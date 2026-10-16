import test from "node:test";
import assert from "node:assert/strict";
import snapshot from "../backend/shopShipping/addressMigration/snapshot.json";
import { assignWholesaleRegion } from "../backend/shopWholesale/regionAssignment.js";
import { normalizeAddressUnit } from "../backend/shopShipping/addressMigration/convert.js";

for (const ward of ["Bến Thành", "Sài Gòn"]) {
  test(`current HCM ward ${ward} in original HCM gets HCM`, () => {
    assert.equal(assignWholesaleRegion({ province: "Thành phố Hồ Chí Minh", ward }).region, "HCM");
  });
}
for (const ward of ["Lái Thiêu", "Dĩ An", "Vũng Tàu", "Bà Rịa", "Phú Mỹ"]) {
  test(`enlarged HCM ward ${ward} outside original boundary gets TINH`, () => {
    assert.equal(assignWholesaleRegion({ province: "Hồ Chí Minh", ward }).region, "TINH");
  });
}
test("legacy districts/wards and common province aliases use exact administrative matches", () => {
  for (const province of ["Hồ Chí Minh", "TP.HCM", "TP HCM", "ho chi minh"]) {
    assert.equal(assignWholesaleRegion({ province, district: "Quận 1", ward: "Bến Nghé" }).region, "HCM");
  }
  assert.equal(assignWholesaleRegion({ province: "TP.HCM", district: "Thành phố Thuận An", ward: "Lái Thiêu" }).region, "TINH");
});
test("old Bình Dương/BRVT and other provinces remain TINH", () => {
  for (const province of ["Bình Dương", "Bà Rịa - Vũng Tàu", "Đồng Nai", "Hà Nội"]) {
    assert.equal(assignWholesaleRegion({ province, ward: "Phường 1" }).region, "TINH");
  }
});

test("pre-2025 numbered wards in District 8 remain inside old HCM", () => {
  for (const number of [1, 2, 3, 8, 9, 10, 11, 12, 13]) {
    assert.equal(assignWholesaleRegion({ province: "Hồ Chí Minh", district: "Quận 8", ward: `Phường ${number}` }).region, "HCM");
  }
  assert.equal(assignWholesaleRegion({ province: "Hồ Chí Minh", district: "Quận 8", ward: "Phường 99" }).region, null);
});
test("uncertain or contradictory HCM addresses never get guessed HCM access", () => {
  for (const address of [
    { province: "TP.HCM", ward: "Phường không có trong danh mục" },
    { province: "TP.HCM", ward: "Thanh An" },
    { province: "TP.HCM", district: "Thuận An", ward: "Bến Thành" },
    { province: "HCM giả", ward: "Bến Thành" },
  ]) assert.equal(assignWholesaleRegion(address).region, null);
});
test("all current HCM wards classify by every mapped legacy origin, including partial mappings", () => {
  const provinceCode = snapshot.provinces.find(([, name]) => normalizeAddressUnit(name) === "ho chi minh")![0];
  let classified = 0;
  for (const [code, parent, ward] of snapshot.wards) {
    if (parent !== provinceCode) continue;
    const origins = new Set(snapshot.legacy.filter(row => (row[4] as string[]).includes(code))
      .map(row => normalizeAddressUnit(String(row[0])) === "ho chi minh" ? "HCM" : "TINH"));
    const sameName = snapshot.wards.filter(([, p, name]) => p === provinceCode && normalizeAddressUnit(name) === normalizeAddressUnit(ward));
    const expected = sameName.length === 1 && origins.size === 1 ? [...origins][0] : null;
    assert.equal(assignWholesaleRegion({ province: "Hồ Chí Minh", ward }).region, expected, ward);
    classified++;
  }
  assert.ok(classified > 100);
});
