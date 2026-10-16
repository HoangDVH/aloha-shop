import test from "node:test";
import assert from "node:assert/strict";
import { wholesalePriceSavings, withServerPrices } from "../backend/shopPromotions/publicRoutes.js";
import type { Db } from "mongodb";
import { isActiveWholesale } from "../backend/shopWholesale/policy.js";

test("wholesale comparison uses full web price, quantity and exact variant; never negative or missing-price savings", () => {
  const items = [{ ma: "T11T", price: 26000, quantity: 3 }, { ma: "OTHER", price: 50000, quantity: 2 },
    { ma: "MISSING", price: 0, quantity: 1 }, { ma: "NO_WEB", price: 10000, quantity: 1 }];
  const web = [{ ma: "T11T", price: 36000, quantity: 3, volumePricing: { basePrice: 40000, discountPercent: 10, quantity: 3 } },
    { ma: "OTHER", price: 45000, quantity: 2 }, { ma: "MISSING", price: 50000, quantity: 1 }];
  assert.equal(wholesalePriceSavings(items, web), 42000);
  assert.equal(wholesalePriceSavings(items, []), 0);
});

test("HCM and TINH use server wholesale prices; retail, CTV and inactive wholesale keep web prices", async () => {
  const docs = [{ ma: "T11T", ten: "Pot", giaWeb: 40000, giaSi: 26000 }];
  const db = { collection: (name: string) => ({ find: () => ({ project() { return this; }, limit() { return this; },
    async toArray() { return name === "aloha_products" ? docs : []; } }) }) } as unknown as Db;
  const requested = [{ ma: "T11T", price: 1, quantity: 1 }];
  const web = await withServerPrices(db, requested, null);
  for (const siRegion of ["HCM", "TINH"]) {
    const account = { roles: ["si"], siStatus: "active", siRegion };
    assert.ok(isActiveWholesale(account));
    const items = await withServerPrices(db, requested, account);
    assert.equal(items[0].price, 26000);
    assert.equal(wholesalePriceSavings(items, web), 14000);
  }
  for (const account of [null, { roles: ["customer"] }, { roles: ["ctv"] }, { roles: ["si"], siStatus: "cho_duyet" },
    { roles: ["si"], siStatus: "active", active: false }]) {
    assert.equal(isActiveWholesale(account), false);
    assert.equal((await withServerPrices(db, requested, account))[0].price, 40000);
  }
});
