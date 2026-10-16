import test from "node:test";
import assert from "node:assert/strict";
import snapshot from "../backend/shopShipping/addressMigration/snapshot.json";
import { assignWholesaleRegion } from "../backend/shopWholesale/regionAssignment.js";
import { normalizeAddressUnit } from "../backend/shopShipping/addressMigration/convert.js";
import { historicalNumberedWards, historicalEasternDistricts } from "./helpers/hcmHistoricalAddresses.js";

test("every old HCM district/ward in the snapshot stays inside the wholesale boundary", () => {
  const rows = snapshot.legacy.filter(row => normalizeAddressUnit(String(row[0])) === "ho chi minh");
  assert.equal(rows.length, 273);
  const failed = rows.filter(row => assignWholesaleRegion({ province: String(row[0]), district: String(row[1]), ward: String(row[2]) }).region !== "HCM");
  assert.deepEqual(failed, []);
});

for (const [district, numbers] of historicalNumberedWards) {
  test(`historic numbered wards in ${district} remain HCM`, () => {
    const failed = numbers.filter(number => assignWholesaleRegion({ province: "Hồ Chí Minh", district, ward: `Phường ${number}` }).region !== "HCM");
    assert.deepEqual(failed, []);
  });
}
for (const [district, wards] of historicalEasternDistricts) {
  test(`pre-2021 ${district} district names remain HCM with exact ward membership`, () => {
    const failed = wards.filter(ward => assignWholesaleRegion({ province: "TP.HCM", district, ward }).region !== "HCM");
    assert.deepEqual(failed, []);
  });
}

test("unknown and contradictory districts or wards do not gain HCM eligibility", () => {
  for (const [district, ward] of [["Quận 2", "Linh Trung"], ["Quận 9", "Thảo Điền"], ["Quận Thủ Đức", "Bình An"],
    ["Quận 8", "Phường 99"], ["Thuận An", "Phường 2"], ["Dĩ An", "Phường 3"]]) {
    assert.notEqual(assignWholesaleRegion({ province: "Hồ Chí Minh", district, ward }).region, "HCM", `${district}/${ward}`);
  }
});
