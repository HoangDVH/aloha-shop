import test from "node:test";
import assert from "node:assert/strict";
import { shopAccountRoleLabel } from "../frontend/lib/accountRoleLabel.js";

test("retail customer is Khách lẻ", () => {
  assert.equal(shopAccountRoleLabel({ roles: ["customer"] }), "Khách lẻ");
});

test("assigned wholesale customers awaiting approval never display as retail", () => {
  assert.equal(shopAccountRoleLabel({ roles: ["customer", "si"], siStatus: "tu_choi" }), "Khách sỉ (cần bổ sung hồ sơ)");
  assert.equal(shopAccountRoleLabel({ roles: ["customer", "si"], siStatus: null }), "Khách sỉ (chưa duyệt quyền mua sỉ)");
  assert.equal(shopAccountRoleLabel({ roles: ["customer", "si"], siStatus: "active" }), "Khách sỉ (chưa xác nhận vùng)");
  assert.equal(shopAccountRoleLabel({ roles: ["customer", "si"], siStatus: "cho_duyet" }), "Khách sỉ (chờ duyệt)");
});

test("active wholesale HCM and province labels", () => {
  assert.equal(
    shopAccountRoleLabel({ roles: ["customer", "si"], siStatus: "active", siRegion: "HCM" }),
    "Khách sỉ HCM"
  );
  assert.equal(
    shopAccountRoleLabel({ roles: ["customer", "si"], siStatus: "active", siRegion: "TINH" }),
    "Khách sỉ tỉnh"
  );
});

test("active collaborator is Cộng tác viên", () => {
  assert.equal(
    shopAccountRoleLabel({ roles: ["customer", "ctv"], ctvStatus: "active" }),
    "Cộng tác viên"
  );
});

test("collaborator who is also wholesale shows both labels", () => {
  assert.equal(
    shopAccountRoleLabel({
      roles: ["customer", "ctv", "si"],
      ctvStatus: "active",
      siStatus: "active",
      siRegion: "HCM",
    }),
    "Cộng tác viên · Khách sỉ HCM"
  );
});
