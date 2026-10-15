import test from "node:test";
import assert from "node:assert/strict";
import { convertDeliveryAddress, newDeliveryAddressText } from "../backend/shopShipping/addressMigration/convert.js";
import { resolveKvDeliveryAddress } from "../backend/shopOrders/kvDeliveryAddress.js";
import data from "../backend/shopShipping/addressMigration/snapshot.json";

test("both reported orders map completely to HCM without a district", () => {
  for (const old of [{ province: "Hồ Chí Minh", district: "Quận 12", ward: "Phường An Phú Đông" },
    { province: "Bình Dương", district: "Thành phố Thuận An", ward: "Phường Lái Thiêu" }]) {
    const r = convertDeliveryAddress({ ...old, streetAddress: "16/3A, khu phố Bình Hòa" });
    assert.equal(r.state, "converted"); assert.equal(r.current?.province, "Thành phố Hồ Chí Minh");
    assert.equal(r.current?.ward, old.ward); assert.deepEqual(r.original, { ...old, streetAddress: "16/3A, khu phố Bình Hòa" });
    assert.equal(newDeliveryAddressText(r, "unused"), `16/3A, khu phố Bình Hòa, ${old.ward}, Thành phố Hồ Chí Minh`);
  }
});
test("split wards, incomplete and wrong districts are explicitly marked for confirmation", () => {
  const split = convertDeliveryAddress({ province: "Hồ Chí Minh", district: "Quận Tân Bình", ward: "Phường 15" });
  assert.equal(split.state, "needs_review"); assert.ok(!split.current);
  assert.ok((split.candidates?.length || 0) >= 2);
  assert.equal(convertDeliveryAddress({ province: "Bình Dương", ward: "Phường Lái Thiêu" }).state, "needs_review");
  assert.equal(convertDeliveryAddress({ province: "Bình Dương", district: "Quận 12", ward: "Phường Lái Thiêu" }).state, "needs_review");
});
test("current addresses are idempotent; administrative suffixes and numeric ward aliases normalize", () => {
  const first = convertDeliveryAddress({ province: "TP. Hồ Chí Minh", district: "Q.12", ward: "An Phú Đông" });
  assert.equal(first.state, "converted");
  assert.equal(convertDeliveryAddress(first.current!).state, "already_current");
  assert.equal(newDeliveryAddressText(first, "45f, An Phú Đông, Q.12, TP. Hồ Chí Minh"), "45f, Phường An Phú Đông, Thành phố Hồ Chí Minh");
});
test("every automatic mapping has exactly one whole-unit destination with valid parent codes", () => {
  const wards = new Map(data.wards.map(([code, province, name]) => [code, { province, name }]));
  let count = 0;
  for (const row of data.legacy) {
    const [province, district, ward, , targets, full] = row as [string,string,string,string,string[],boolean];
    const result = convertDeliveryAddress({ province, district, ward });
    if (result.state !== "converted") continue;
    assert.equal(full, true); assert.equal(targets.length, 1);
    assert.equal(result.current?.wardCode, targets[0]);
    assert.equal(result.current?.provinceCode, wards.get(targets[0])?.province); count++;
  }
  assert.ok(count > 9000);
});
test("ambiguous and unavailable KiotViet provinces retain legacy copy with a visible review warning", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () => Response.json({ total: 1, data: [{ id: 339, name: "Hồ Chí Minh - Quận 12" }] })) as typeof fetch;
    const r = await resolveKvDeliveryAddress({ retailer: "migration-review", clientId: "test", clientSecret: "test" }, "test",
      { province: "Hồ Chí Minh", district: "Quận 12", ward: "An Phú Đông" }, "45f, An Phú Đông, Quận 12, Hồ Chí Minh");
    assert.equal(r.audit?.state, "needs_review"); assert.equal(r.region.locationId, 339);
    assert.ok(r.warning?.includes("CẦN XÁC NHẬN")); assert.ok(r.address.includes("Quận 12"));
  } finally { globalThis.fetch = original; }
});
