import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { isStaffActive, verifyStaffPassword } from "../backend/auth/staffAccounts.js";

test("plaintext password in users.password", async () => {
  const doc = { username: "u", password: "abc123" };
  assert.equal(await verifyStaffPassword("abc123", doc), true);
  assert.equal(await verifyStaffPassword("abc124", doc), false);
  assert.equal(await verifyStaffPassword("", doc), false);
});

test("bcrypt hash in passwordHash or password", async () => {
  const hash = await bcrypt.hash("secret9", 4);
  assert.equal(await verifyStaffPassword("secret9", { passwordHash: hash }), true);
  assert.equal(await verifyStaffPassword("secret8", { passwordHash: hash }), false);
  assert.equal(await verifyStaffPassword("secret9", { password: hash }), true);
  assert.equal(await verifyStaffPassword(hash, { password: hash }), false);
});

test("missing password never matches", async () => {
  assert.equal(await verifyStaffPassword("", {}), false);
  assert.equal(await verifyStaffPassword("x", { password: null }), false);
});

test("active unless active or isActive is false", () => {
  assert.equal(isStaffActive({}), true);
  assert.equal(isStaffActive({ active: true, isActive: true }), true);
  assert.equal(isStaffActive({ active: false }), false);
  assert.equal(isStaffActive({ isActive: false }), false);
});
