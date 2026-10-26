import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import http from "node:http";
import {
  ensureVapidConfig,
  getVapidPublicKey,
  savePushSubscription,
  removePushSubscription,
  getPushSubscriptionCount,
  broadcastAdminWebPush,
  SHOP_SETTINGS_COL,
  SHOP_PUSH_COL,
} from "../backend/shopPush/webPushService.js";
import { registerShopPushRoutes } from "../backend/shopPush/routes.js";

class MockCollection {
  public docs: any[] = [];
  constructor(initialDocs: any[] = []) {
    this.docs = [...initialDocs];
  }
  async findOne(query: any = {}) {
    if (query?._id) return this.docs.find((d) => d._id === query._id) || null;
    if (query?.endpoint) return this.docs.find((d) => d.endpoint === query.endpoint) || null;
    return this.docs[0] || null;
  }
  find(_query: any = {}) {
    let res = [...this.docs];
    return {
      toArray: async () => res,
    };
  }
  async countDocuments() {
    return this.docs.length;
  }
  async updateOne(filter: any, update: any, opts: any = {}) {
    let doc = this.docs.find((d) => {
      if (filter._id) return d._id === filter._id;
      if (filter.endpoint) return d.endpoint === filter.endpoint;
      return false;
    });

    if (!doc && opts.upsert) {
      doc = { ...filter, ...(update.$set || {}), ...(update.$setOnInsert || {}) };
      this.docs.push(doc);
      return { upsertedCount: 1, modifiedCount: 0 };
    }
    if (doc) {
      Object.assign(doc, update.$set || {});
      return { upsertedCount: 0, modifiedCount: 1 };
    }
    return { upsertedCount: 0, modifiedCount: 0 };
  }
  async deleteOne(filter: any) {
    const idx = this.docs.findIndex((d) => d.endpoint === filter?.endpoint);
    if (idx >= 0) {
      this.docs.splice(idx, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }
  async deleteMany(filter: any) {
    const list = filter?.endpoint?.$in || [];
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !list.includes(d.endpoint));
    return { deletedCount: before - this.docs.length };
  }
}

class MockDb {
  private collections: Record<string, MockCollection> = {};
  collection(name: string) {
    if (!this.collections[name]) {
      this.collections[name] = new MockCollection();
    }
    return this.collections[name] as any;
  }
}

test("VAPID key generation and persistence in MongoDB", async () => {
  const mockDb = new MockDb();
  const config = await ensureVapidConfig(mockDb as any);

  assert.ok(config.publicKey, "Should generate public key");
  assert.ok(config.privateKey, "Should generate private key");

  const pubKey = await getVapidPublicKey(mockDb as any);
  assert.equal(pubKey, config.publicKey, "Should retrieve cached/saved public key");

  const savedDoc = await mockDb.collection(SHOP_SETTINGS_COL).findOne({ _id: "vapid_keys" });
  assert.ok(savedDoc, "Should persist to aloha_shop_settings");
  assert.equal(savedDoc.publicKey, config.publicKey);
});

test("Push subscription registration, count, and removal", async () => {
  const mockDb = new MockDb();

  await savePushSubscription(
    mockDb as any,
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/test-device-1",
      keys: {
        p256dh: "mock-p256dh-key-sample",
        auth: "mock-auth-key-sample",
      },
    },
    { username: "manager_admin", role: "manager" }
  );

  let count = await getPushSubscriptionCount(mockDb as any);
  assert.equal(count, 1, "Should have 1 registered device");

  // Save same endpoint with updated keys -> should upsert, not duplicate
  await savePushSubscription(
    mockDb as any,
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/test-device-1",
      keys: {
        p256dh: "updated-key",
        auth: "updated-auth",
      },
    },
    { username: "manager_admin", role: "manager" }
  );

  count = await getPushSubscriptionCount(mockDb as any);
  assert.equal(count, 1, "Should still have 1 registered device after upsert");

  // Remove subscription
  const removed = await removePushSubscription(
    mockDb as any,
    "https://fcm.googleapis.com/fcm/send/test-device-1"
  );
  assert.equal(removed, true, "Should return true when deleted");

  count = await getPushSubscriptionCount(mockDb as any);
  assert.equal(count, 0, "Should have 0 devices after deletion");
});

test("Shop Push HTTP routes (GET vapid, POST subscribe, POST test)", async () => {
  const mockDb = new MockDb();
  const { signAccessToken } = await import("../backend/auth/tokens.js");
  const { STAFF_USERS } = await import("../backend/auth/staffAccounts.js");

  // Create staff user in mockDb
  await mockDb.collection(STAFF_USERS).updateOne(
    { _id: "admin_1" },
    {
      $set: {
        _id: "admin_1",
        username: "dauvu",
        role: "manager",
        status: "active",
        approvalStatus: "approved",
      },
    },
    { upsert: true }
  );

  const token = signAccessToken({
    sub: "admin_1",
    username: "dauvu",
    role: "manager",
  });

  const app = express();
  app.use(express.json());

  registerShopPushRoutes(
    app,
    async () => mockDb as any,
    async () => mockDb as any
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. GET vapid-public-key
    const resKey = await fetch(`${baseUrl}/api/shop/admin/push/vapid-public-key`, {
      headers: authHeaders,
    });
    const keyData = await resKey.json();
    assert.equal(resKey.status, 200);
    assert.equal(keyData.ok, true);
    assert.ok(typeof keyData.publicKey === "string" && keyData.publicKey.length > 20);

    // 2. POST subscribe
    const resSub = await fetch(`${baseUrl}/api/shop/admin/push/subscribe`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        subscription: {
          endpoint: "https://push.apple.com/test-iphone-sub",
          keys: {
            p256dh: "test-p256dh",
            auth: "test-auth",
          },
        },
      }),
    });
    const subData = await resSub.json();
    assert.equal(resSub.status, 200);
    assert.equal(subData.ok, true);

    // 3. GET status
    const resStatus = await fetch(`${baseUrl}/api/shop/admin/push/status`, {
      headers: authHeaders,
    });
    const statusData = await resStatus.json();
    assert.equal(resStatus.status, 200);
    assert.equal(statusData.subscriptionsCount, 1);

    // 4. POST unsubscribe
    const resUnsub = await fetch(`${baseUrl}/api/shop/admin/push/unsubscribe`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        endpoint: "https://push.apple.com/test-iphone-sub",
      }),
    });
    const unsubData = await resUnsub.json();
    assert.equal(resUnsub.status, 200);
    assert.equal(unsubData.removed, true);
  } finally {
    server.close();
  }
});
