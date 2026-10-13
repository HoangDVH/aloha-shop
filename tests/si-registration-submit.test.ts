import test from "node:test";
import assert from "node:assert/strict";
import { submitSiRegistration } from "../frontend/lib/siRegistrationSubmit.js";
import { siRegisterSchema } from "../frontend/lib/siRegisterSchema.js";
const values = { phone: "0901234567", province: "TP.HCM", district: "", ward: "Phường 1", detail: "123 đường A",
  fullName: "Khách sỉ", shopName: "", businessType: "", taxCode: "", note: "", email: "test@example.com", password: "password", acceptedTerms: true };
test("one submission checks current address and submits even when KV lookup is unavailable", async () => {
  const calls: any[] = [];
  const request = async <T>(path: string, body: unknown): Promise<T> => {
    calls.push({ path, body });
    return (calls.length === 1 ? { lookupId: "fresh-id", result: "lookup_unavailable" } : { user: { id: "customer" } }) as T;
  };
  const result = await submitSiRegistration(values, true, request);
  assert.equal(result.user.id, "customer");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.detail, values.detail);
  assert.equal(calls[1].body.lookupId, "fresh-id");
  assert.equal(calls[1].body.acceptedTerms, true);
  assert.equal(calls[1].body.email, undefined);
  assert.equal(calls[1].body.password, undefined);
});
test("phone ownership failures prevent registration and preserve the original error", async () => {
  const error = Object.assign(new Error("Phone belongs to another account"), { code: "phone_belongs_to_other" });
  let calls = 0;
  await assert.rejects(submitSiRegistration(values, true, async () => { calls++; throw error; }), e => e === error);
  assert.equal(calls, 1);
});
test("combined form still requires contact, address and explicit terms acceptance", () => {
  assert.equal(siRegisterSchema.safeParse(values).success, true);
  for (const patch of [{ acceptedTerms: false }, { fullName: "" }, { phone: "" }, { ward: "" }, { detail: "" }]) {
    assert.equal(siRegisterSchema.safeParse({ ...values, ...patch }).success, false);
  }
});
