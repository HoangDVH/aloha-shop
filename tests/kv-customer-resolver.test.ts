import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCustomerPhone,
  resolveKvCustomerIdForAccount,
} from "../backend/shopOrders/kvCustomerResolver.js";

test("normalizeCustomerPhone handles 84 prefix, spaces and invalid lengths", () => {
  assert.equal(normalizeCustomerPhone("0912345678"), "0912345678");
  assert.equal(normalizeCustomerPhone("84912345678"), "0912345678");
  assert.equal(normalizeCustomerPhone("+84 912 345 678"), "0912345678");
  assert.equal(normalizeCustomerPhone("0912-345-678"), "0912345678");
  assert.equal(normalizeCustomerPhone("123"), "");
  assert.equal(normalizeCustomerPhone(""), "");
  assert.equal(normalizeCustomerPhone(null), "");
});

test("resolveKvCustomerIdForAccount returns existing kvCustomerId from Mongo with 0 network calls", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("");
  }) as typeof fetch;

  try {
    const mockShopDb = {
      collection: () => ({
        findOne: async () => ({
          _id: "user123",
          kvCustomerId: 998877,
          roles: ["customer"],
        }),
      }),
    } as any;

    const id = await resolveKvCustomerIdForAccount({
      shopDb: mockShopDb,
      opsDb: {} as any,
      accountId: "user123",
      phone: "0912345678",
    });

    assert.equal(id, 998877);
    assert.equal(fetchCalled, false, "Should not call fetch when kvCustomerId is cached");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolveKvCustomerIdForAccount protects wholesale accounts without kvCustomerId", async () => {
  const mockShopDb = {
    collection: () => ({
      findOne: async () => ({
        _id: "si_user",
        roles: ["si"],
        siStatus: "active",
        kvCustomerId: null,
      }),
    }),
  } as any;

  const id = await resolveKvCustomerIdForAccount({
    shopDb: mockShopDb,
    opsDb: {} as any,
    accountId: "si_user",
    phone: "0912345678",
  });

  assert.equal(id, null, "Must not create a retail customer for wholesale accounts");
});

test("resolveKvCustomerIdForAccount finds existing customer on KiotViet by phone", async () => {
  const originalFetch = globalThis.fetch;
  const env = { ...process.env };
  let updatedAccount: any = null;

  try {
    Object.assign(process.env, {
      KV_CLIENT_ID: "test",
      KV_CLIENT_SECRET: "test",
      KV_RETAILER: "retailer-test",
      SHOP_KV_BRANCH_ID: "1",
    });

    globalThis.fetch = (async (url: any) => {
      const u = String(url);
      if (u.includes("connect/token")) {
        return Response.json({ access_token: "mock-token" });
      }
      if (u.includes("/customers?contactNumber=")) {
        return Response.json({
          total: 1,
          data: [{ id: 554433, code: "KH554433", contactNumber: "0912345678", isActive: true }],
        });
      }
      return new Response("Not found", { status: 404 });
    }) as typeof fetch;

    const mockShopDb = {
      collection: () => ({
        findOne: async () => ({ _id: "user1", kvCustomerId: null }),
        updateOne: async (_filter: any, update: any) => {
          updatedAccount = update;
          return { matchedCount: 1 };
        },
      }),
    } as any;

    const id = await resolveKvCustomerIdForAccount({
      shopDb: mockShopDb,
      opsDb: {} as any,
      accountId: "user1",
      phone: "0912345678",
      fullName: "Nguyễn Văn A",
    });

    assert.equal(id, 554433);
    assert.equal(updatedAccount?.$set?.kvCustomerId, 554433);
    assert.equal(updatedAccount?.$set?.kvCustomerCode, "KH554433");
  } finally {
    globalThis.fetch = originalFetch;
    process.env = env;
  }
});

test("resolveKvCustomerIdForAccount creates new customer on KiotViet when not found", async () => {
  const originalFetch = globalThis.fetch;
  const env = { ...process.env };
  let postPayload: any = null;
  let updatedAccount: any = null;

  try {
    Object.assign(process.env, {
      KV_CLIENT_ID: "test",
      KV_CLIENT_SECRET: "test",
      KV_RETAILER: "retailer-test",
      SHOP_KV_BRANCH_ID: "1",
    });

    globalThis.fetch = (async (url: any, init: any) => {
      const u = String(url);
      if (u.includes("connect/token")) {
        return Response.json({ access_token: "mock-token" });
      }
      if (u.includes("/customers?contactNumber=")) {
        return Response.json({ total: 0, data: [] });
      }
      if (u.endsWith("/customers") && init?.method === "POST") {
        postPayload = JSON.parse(String(init.body));
        return Response.json({ data: { id: 778899, code: "KH_NEW_7788" } });
      }
      return new Response("Not found", { status: 404 });
    }) as typeof fetch;

    const mockShopDb = {
      collection: () => ({
        findOne: async () => ({ _id: "user2", kvCustomerId: null }),
        updateOne: async (_filter: any, update: any) => {
          updatedAccount = update;
          return { matchedCount: 1 };
        },
      }),
    } as any;

    const id = await resolveKvCustomerIdForAccount({
      shopDb: mockShopDb,
      opsDb: {} as any,
      accountId: "user2",
      phone: "+84 987 654 321",
      fullName: "Trần Thị B",
      address: "123 Đường Số 1",
    });

    assert.equal(id, 778899);
    assert.equal(postPayload?.name, "Trần Thị B");
    assert.equal(postPayload?.contactNumber, "0987654321");
    assert.equal(postPayload?.comments, "Khách hàng Aloha Web");
    assert.equal(postPayload?.groupIds, undefined, "Must not set groupIds for retail customer");
    assert.equal(updatedAccount?.$set?.kvCustomerId, 778899);
    assert.equal(updatedAccount?.$set?.kvCustomerCode, "KH_NEW_7788");
  } finally {
    globalThis.fetch = originalFetch;
    process.env = env;
  }
});

test("resolveKvCustomerIdForAccount safely soft-fails on network/KV error without throwing", async () => {
  const originalFetch = globalThis.fetch;
  const env = { ...process.env };

  try {
    Object.assign(process.env, {
      KV_CLIENT_ID: "test",
      KV_CLIENT_SECRET: "test",
      KV_RETAILER: "retailer-test",
    });

    globalThis.fetch = (async () => {
      throw new Error("KiotViet Network Timeout");
    }) as typeof fetch;

    const mockShopDb = {
      collection: () => ({
        findOne: async () => ({ _id: "user3", kvCustomerId: null }),
      }),
    } as any;

    const id = await resolveKvCustomerIdForAccount({
      shopDb: mockShopDb,
      opsDb: {} as any,
      accountId: "user3",
      phone: "0912345678",
    });

    assert.equal(id, null, "Should return null on error, never crash");
  } finally {
    globalThis.fetch = originalFetch;
    process.env = env;
  }
});
