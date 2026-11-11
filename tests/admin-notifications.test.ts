import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import http from "node:http";
import { registerShopAdminOpsRoutes } from "../backend/shopOrders/adminOpsStream.js";
import { SHOP_ORDERS } from "../backend/shopOrders/models.js";
import { SHOP_ACCOUNTS } from "../backend/shopAuth/models.js";
import { APPLICATIONS_COL } from "../backend/shopRecruitment/types.js";
import { STAFF_USERS } from "../backend/auth/staffAccounts.js";
import { signAccessToken } from "../backend/auth/tokens.js";
import {
  ADMIN_NOTIFICATIONS,
  ADMIN_NOTIFICATION_READS,
  buildOrderNotificationFields,
  syncAdminNotificationEntity,
} from "../backend/shopNotifications/adminNotificationStore.js";
import {
  emitCtvRegistered,
  emitOrderCreated,
  emitRecruitmentApplied,
  emitWholesaleRegistered,
} from "../backend/shopNotifications/domainEvents.js";
import { zaloNotifyService } from "../backend/shopWholesale/zaloNotifyService.js";
import { dateRangeMatch, toIsoString } from "../backend/utils/mongoDate.js";
import { buildOrderDoc } from "../backend/shopOrders/create/orderDoc.js";
import { ADMIN_NOTIFICATION_TYPES } from "../shared/opsContracts.js";

function getByPath(obj: any, path: string): any {
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function setByPath(obj: any, path: string, value: any) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function sameTypeBoundCompare(a: unknown, b: unknown, cmp: (diff: number) => boolean): boolean {
  if (a instanceof Date && b instanceof Date) return cmp(a.getTime() - b.getTime());
  if (typeof a === "string" && typeof b === "string") return cmp(a.localeCompare(b));
  if (typeof a === "number" && typeof b === "number") return cmp(a - b);
  return false;
}

function matchesField(val: unknown, cond: any): boolean {
  if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
    const ops = Object.keys(cond);
    const hasMongoOp = ops.some((k) => k.startsWith("$"));
    if (hasMongoOp) {
      for (const [op, target] of Object.entries(cond)) {
        if (op === "$exists") {
          const exists = val !== undefined;
          if (Boolean(target) !== exists) return false;
        } else if (op === "$ne") {
          if (val === target) return false;
        } else if (op === "$in") {
          const arr = Array.isArray(target) ? target : [];
          if (Array.isArray(val)) {
            if (!val.some((v) => arr.includes(v))) return false;
          } else if (!arr.includes(val)) {
            return false;
          }
        } else if (op === "$nin") {
          const arr = Array.isArray(target) ? target : [];
          if (Array.isArray(val)) {
            if (val.some((v) => arr.includes(v))) return false;
          } else if (arr.includes(val)) {
            return false;
          }
        } else if (op === "$gte") {
          if (!sameTypeBoundCompare(val, target, (d) => d >= 0)) return false;
        } else if (op === "$gt") {
          if (!sameTypeBoundCompare(val, target, (d) => d > 0)) return false;
        } else if (op === "$lte") {
          if (!sameTypeBoundCompare(val, target, (d) => d <= 0)) return false;
        } else if (op === "$lt") {
          if (!sameTypeBoundCompare(val, target, (d) => d < 0)) return false;
        } else if (op === "$type") {
          if (target === "string" && typeof val !== "string") return false;
          if (target === "date" && !(val instanceof Date)) return false;
        }
      }
      return true;
    }
  }
  if (Array.isArray(val)) return val.includes(cond);
  return val === cond;
}

function matchesQuery(doc: Record<string, any>, query: Record<string, any> = {}): boolean {
  for (const [key, val] of Object.entries(query)) {
    if (key === "$and" && Array.isArray(val)) {
      if (!val.every((sub) => matchesQuery(doc, sub))) return false;
    } else if (key === "$or" && Array.isArray(val)) {
      if (!val.some((sub) => matchesQuery(doc, sub))) return false;
    } else if (!matchesField(getByPath(doc, key), val)) {
      return false;
    }
  }
  return true;
}

class StatefulMockCollection {
  public docs: any[] = [];
  private uniqueKey?: string;

  constructor(initialDocs: any[] = [], uniqueKey?: string) {
    this.docs = initialDocs.map((d) => structuredClone(d));
    this.uniqueKey = uniqueKey;
  }

  async createIndex() {
    return "mock_idx";
  }

  find(query: Record<string, any> = {}, _opts: any = {}) {
    let res = this.docs.filter((d) => matchesQuery(d, query));
    return {
      sort(spec: Record<string, 1 | -1>) {
        const entries = Object.entries(spec || {});
        res = [...res].sort((a, b) => {
          for (const [field, dir] of entries) {
            const va = a[field] instanceof Date ? a[field].getTime() : a[field];
            const vb = b[field] instanceof Date ? b[field].getTime() : b[field];
            if (va === vb) continue;
            if (va === undefined || va === null) return 1;
            if (vb === undefined || vb === null) return -1;
            return va < vb ? -dir : dir;
          }
          return 0;
        });
        return this;
      },
      limit(n: number) {
        res = res.slice(0, n);
        return this;
      },
      toArray: async () => res.map((d) => structuredClone(d)),
    };
  }

  async findOne(query: Record<string, any> = {}) {
    const found = this.docs.find((d) => matchesQuery(d, query));
    return found ? structuredClone(found) : null;
  }

  async countDocuments(query: Record<string, any> = {}) {
    return this.docs.filter((d) => matchesQuery(d, query)).length;
  }

  async insertOne(doc: any) {
    if (this.uniqueKey && doc[this.uniqueKey] !== undefined) {
      const exists = this.docs.some((d) => d[this.uniqueKey!] === doc[this.uniqueKey!]);
      if (exists) {
        throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
      }
    }
    const copy = structuredClone(doc);
    if (!copy._id) copy._id = `id_${this.docs.length + 1}`;
    this.docs.push(copy);
    return { insertedId: copy._id };
  }

  private applyUpdate(doc: any, update: Record<string, any>, isInsert: boolean) {
    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) {
        setByPath(doc, k, structuredClone(v));
      }
    }
    if (isInsert && update.$setOnInsert) {
      for (const [k, v] of Object.entries(update.$setOnInsert)) {
        setByPath(doc, k, structuredClone(v));
      }
    }
  }

  async updateOne(filter: Record<string, any>, update: Record<string, any>, opts: any = {}) {
    const idx = this.docs.findIndex((d) => matchesQuery(d, filter));
    if (idx >= 0) {
      this.applyUpdate(this.docs[idx], update, false);
      return { matchedCount: 1, modifiedCount: 1 };
    }
    if (opts?.upsert) {
      const fresh: Record<string, any> = { ...filter };
      this.applyUpdate(fresh, update, true);
      if (!fresh._id) fresh._id = `id_${this.docs.length + 1}`;
      this.docs.push(fresh);
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: fresh._id };
    }
    return { matchedCount: 0, modifiedCount: 0 };
  }

  async updateMany(filter: Record<string, any>, update: Record<string, any>) {
    let modified = 0;
    for (const d of this.docs) {
      if (matchesQuery(d, filter)) {
        this.applyUpdate(d, update, false);
        modified += 1;
      }
    }
    return { matchedCount: modified, modifiedCount: modified };
  }

  async deleteMany(filter: Record<string, any>) {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !matchesQuery(d, filter));
    return { deletedCount: before - this.docs.length };
  }
}

function createMockDb(seed?: {
  orders?: any[];
  accounts?: any[];
  recruitment?: any[];
  users?: any[];
}) {
  const collections = new Map<string, StatefulMockCollection>([
    [SHOP_ORDERS, new StatefulMockCollection(seed?.orders || [])],
    [SHOP_ACCOUNTS, new StatefulMockCollection(seed?.accounts || [])],
    [APPLICATIONS_COL, new StatefulMockCollection(seed?.recruitment || [])],
    [
      STAFF_USERS,
      new StatefulMockCollection(
        seed?.users || [{ _id: "mgr_1", username: "admin1", role: "manager", active: true }]
      ),
    ],
    [ADMIN_NOTIFICATIONS, new StatefulMockCollection([], "dedupeKey")],
    [ADMIN_NOTIFICATION_READS, new StatefulMockCollection([], "adminKey")],
  ]);

  return {
    collection(name: string) {
      let col = collections.get(name);
      if (!col) {
        col = new StatefulMockCollection([]);
        collections.set(name, col);
      }
      return col;
    },
  } as any;
}

async function withOpsServer(
  db: any,
  fn: (baseUrl: string, token: string) => Promise<void>
) {
  const app = express();
  app.use(express.json());
  registerShopAdminOpsRoutes(app, async () => db, async () => db);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const token = signAccessToken({ sub: "mgr_1", username: "admin1", role: "manager" });

  try {
    await fn(`http://127.0.0.1:${port}`, token);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("ops notifications endpoint enforces auth and backfills persistent feed with accurate siPending", async () => {
  const db = createMockDb({
    orders: [
      {
        code: "WEB-261026-ABCD",
        customerName: "Nguyễn Văn A",
        customerPhone: "0901234567",
        grandTotal: 1500000,
        orderStatus: "cho_xu_ly",
        paymentStatus: "unpaid",
        priceMode: "web",
        createdAt: new Date("2026-10-26T10:00:00Z"),
      },
      {
        code: "DH-QUICK-001",
        customerName: "Khách Quick",
        customerPhone: "0909999999",
        grandTotal: 220000,
        orderStatus: "cho_thanh_toan",
        paymentStatus: "unpaid",
        source: "admin_quick",
        priceMode: "web",
        createdAt: new Date("2026-10-26T09:55:00Z"),
      },
    ],
    accounts: [
      {
        _id: "si_direct_1",
        fullName: "Vựa Cây Bình Dương",
        phone: "0912345678",
        email: "si1@gmail.com",
        roles: ["customer", "si"],
        siStatus: "active",
        siVerificationStatus: "pending",
        siVerification: { status: "pending" },
        siKvSyncStatus: "awaiting_verification",
        siRegion: "TINH",
        createdAt: new Date("2026-10-26T08:00:00Z"),
      },
      {
        _id: "si_approved_1",
        fullName: "Sỉ Đã Duyệt",
        phone: "0911111111",
        roles: ["si"],
        siStatus: "active",
        siVerificationStatus: "approved",
        siKvSyncStatus: "matched",
        createdAt: new Date("2026-10-26T07:00:00Z"),
      },
      {
        _id: "ctv_acc_1",
        fullName: "Lê Văn C",
        phone: "0933333333",
        roles: ["customer", "ctv"],
        ctvStatus: "cho_duyet",
        ctvCode: "CTV999",
        createdAt: new Date("2026-10-26T07:30:00Z"),
      },
    ],
    recruitment: [
      {
        _id: "app_1",
        publicCode: "TD-ABC12345",
        contact: { fullName: "Phạm Văn D", phone: "0944444444" },
        jobSummary: { title: "Nhân viên Bán Hàng" },
        status: "new",
        createdAt: new Date("2026-10-26T06:00:00Z"),
      },
    ],
  });

  await withOpsServer(db, async (baseUrl, token) => {
    const unauth = await fetch(`${baseUrl}/api/shop/admin/ops/notifications`);
    assert.equal(unauth.status, 401);

    const res = await fetch(`${baseUrl}/api/shop/admin/ops/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.ok, true);
    assert.equal(body.counts.orders, 2);
    assert.equal(body.counts.wholesale, 1, "Direct awaiting_verification wholesale account must be counted");
    assert.equal(body.counts.ctv, 1);
    assert.equal(body.counts.recruitment, 1);
    assert.equal(body.items.length, 6);

    const siItem = body.items.find((i: any) => i.id.startsWith("wholesale:si_direct_1"));
    assert.ok(siItem);
    assert.equal(siItem.tag, "Chờ duyệt");
    assert.equal(siItem.needsAction, true);

    const quickItem = body.items.find((i: any) => i.id === "order:DH-QUICK-001");
    assert.ok(quickItem);
    assert.equal(quickItem.tag, "Đơn tạo nhanh");
  });
});

test("domain events prevent crowding out, keep upgrade eventAt fresh, sync live status, and persist server reads", async () => {
  const db = createMockDb();

  // Record initial read-all at T1
  await withOpsServer(db, async (baseUrl, token) => {
    // Seed an older customer who already existed before T1
    await db.collection(SHOP_ACCOUNTS).insertOne({
      _id: "old_cust_ctv",
      fullName: "Khách Cũ Nâng Cấp CTV",
      phone: "0977000111",
      roles: ["customer", "ctv"],
      ctvStatus: "cho_duyet",
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
    await db.collection(SHOP_ACCOUNTS).insertOne({
      _id: "old_cust_si",
      fullName: "Khách Cũ Đăng Ký Sỉ",
      phone: "0977000222",
      roles: ["customer", "si"],
      siStatus: "active",
      siVerificationStatus: "pending",
      siKvSyncStatus: "awaiting_verification",
      createdAt: new Date("2025-02-01T00:00:00Z"),
    });

    // Seed initial Read All at T1 = 2 minutes in the past (before simulated events)
    const t1 = Date.now() - 120_000;
    await db.collection(ADMIN_NOTIFICATION_READS).updateOne(
      { adminKey: "mgr_1" },
      {
        $set: {
          adminKey: "mgr_1",
          readAllAt: new Date(t1),
          readIds: [],
          createdAt: new Date(t1),
          updatedAt: new Date(t1),
        },
      },
      { upsert: true }
    );

    // Emit 25 Quick Orders strictly after T1 (but still in the past relative to wall clock)
    for (let i = 1; i <= 25; i++) {
      await emitOrderCreated({
        shopDb: db,
        order: {
          code: `DH-QO-${i}`,
          customerName: `Quick ${i}`,
          customerPhone: `09000000${String(i).padStart(2, "0")}`,
          grandTotal: 100000 * i,
          orderStatus: "cho_xu_ly",
          paymentStatus: "unpaid",
          source: "admin_quick",
          createdAt: new Date(t1 + i * 1000),
        },
        notifyPush: false,
        notifyZalo: false,
      });
    }

    // Old customer upgrades to CTV and another to Wholesale after T1, plus 1 web order and 1 recruitment
    const upgradeTime = new Date(t1 + 30_000);
    await emitCtvRegistered({
      shopDb: db,
      account: await db.collection(SHOP_ACCOUNTS).findOne({ _id: "old_cust_ctv" }),
      noticeType: "upgrade",
      eventAt: upgradeTime,
    });
    await emitWholesaleRegistered({
      shopDb: db,
      account: await db.collection(SHOP_ACCOUNTS).findOne({ _id: "old_cust_si" }),
      eventAt: new Date(t1 + 31_000),
      notifyZalo: false,
    });
    await emitRecruitmentApplied({
      shopDb: db,
      application: {
        _id: "app_fresh",
        publicCode: "TD-FRESH",
        contact: { fullName: "Ứng viên Mới", phone: "0988111222" },
        jobSummary: { title: "Kho vận" },
        status: "new",
        createdAt: new Date(t1 + 32_000),
      },
      zaloPayload: {
        fullName: "Ứng viên Mới",
        phone: "0988111222",
        position: "Kho vận",
        publicCode: "TD-FRESH",
      },
    });
    await emitOrderCreated({
      shopDb: db,
      order: {
        code: "WEB-FRESH-01",
        customerName: "Khách Web Mới",
        customerPhone: "0988333444",
        grandTotal: 990000,
        orderStatus: "cho_xu_ly",
        paymentStatus: "unpaid",
        priceMode: "web",
        createdAt: new Date(t1 + 33_000),
      },
      notifyPush: false,
      notifyZalo: false,
    });

    // Fetch feed: top items must contain Web order, recruitment, si upgrade, ctv upgrade AND latest quick orders
    const res1 = await fetch(`${baseUrl}/api/shop/admin/ops/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const feed1 = (await res1.json()) as any;
    assert.equal(feed1.items.length, 29);
    assert.equal(feed1.unreadCount, 29);

    const ctvUpItem = feed1.items.find((i: any) => i.id === "ctv:old_cust_ctv:upgrade");
    assert.ok(ctvUpItem, "Upgraded CTV must appear in feed");
    assert.equal(ctvUpItem.isRead, false, "Upgraded CTV after T1 must remain unread");
    assert.equal(ctvUpItem.eventAt, upgradeTime.toISOString(), "Upgrade must use upgrade eventAt, not 2025 createdAt");

    const siUpItem = feed1.items.find((i: any) => i.id.startsWith("wholesale:old_cust_si"));
    assert.ok(siUpItem && siUpItem.isRead === false);

    // Sync live order status -> preserves historical eventAt while updating tag/detail
    const completedOrder = {
      code: "WEB-FRESH-01",
      customerName: "Khách Web Mới",
      customerPhone: "0988333444",
      grandTotal: 990000,
      orderStatus: "hoan_thanh",
      paymentStatus: "paid",
      priceMode: "web",
    };
    await syncAdminNotificationEntity(db, {
      entityType: ADMIN_NOTIFICATION_TYPES.ORDER,
      entityId: "WEB-FRESH-01",
      fields: buildOrderNotificationFields(completedOrder),
    });

    // Mark single notification read
    const readSingle = await fetch(`${baseUrl}/api/shop/admin/ops/notifications/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: "order:WEB-FRESH-01" }),
    });
    assert.equal(readSingle.status, 200);

    const res2 = await fetch(`${baseUrl}/api/shop/admin/ops/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const feed2 = (await res2.json()) as any;
    const syncedOrderItem = feed2.items.find((i: any) => i.id === "order:WEB-FRESH-01");
    assert.equal(syncedOrderItem.isRead, true);
    assert.equal(syncedOrderItem.detail, "Hoàn thành");
    assert.equal(syncedOrderItem.needsAction, false);
    assert.equal(syncedOrderItem.eventAt, new Date(t1 + 33_000).toISOString());
    assert.equal(feed2.unreadCount, 28);

    // Mark all read -> unreadCount becomes 0 across fresh requests
    await fetch(`${baseUrl}/api/shop/admin/ops/notifications/read-all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const res3 = await fetch(`${baseUrl}/api/shop/admin/ops/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const feed3 = (await res3.json()) as any;
    assert.equal(feed3.unreadCount, 0);
    assert.ok(feed3.items.every((i: any) => i.isRead === true));
  });
});

test("zaloNotifyService.sendNewOrderNotice formats nhan_cua_hang and legacy lay_tai_tiem as Đến tiệm lấy", async () => {
  const sentMessages: string[] = [];
  const origGetGroup = zaloNotifyService.getGroupIdForType.bind(zaloNotifyService);
  const origSendToGroup = zaloNotifyService.sendToGroup.bind(zaloNotifyService);
  (zaloNotifyService as any).getGroupIdForType = async () => "mock_group_id";
  (zaloNotifyService as any).sendToGroup = async (_gid: string, text: string) => {
    sentMessages.push(text);
    return { success: true };
  };

  try {
    for (const deliveryMethod of ["nhan_cua_hang", "lay_tai_tiem", "giao_tan_noi"]) {
      await zaloNotifyService.sendNewOrderNotice({
        orderCode: `WEB-TEST-${deliveryMethod}`,
        customerName: "Nguyễn Văn Test",
        phone: "0901000222",
        total: 350000,
        deliveryMethod,
      });
    }
    assert.ok(sentMessages[0].includes("🚚 Hình thức: Đến tiệm lấy"));
    assert.ok(sentMessages[1].includes("🚚 Hình thức: Đến tiệm lấy"));
    assert.ok(sentMessages[2].includes("🚚 Hình thức: Giao tận nơi"));
  } finally {
    (zaloNotifyService as any).getGroupIdForType = origGetGroup;
    (zaloNotifyService as any).sendToGroup = origSendToGroup;
  }
});

test("dateRangeMatch matches both BSON Date and legacy ISO strings and toIsoString formats both", async () => {
  const col = new StatefulMockCollection([
    { code: "D_NEW", createdAt: new Date("2026-10-20T00:00:00Z") },
    { code: "S_NEW", createdAt: "2026-10-21T00:00:00.000Z" },
    { code: "D_OLD", createdAt: new Date("2026-09-01T00:00:00Z") },
    { code: "S_OLD", createdAt: "2026-09-02T00:00:00.000Z" },
  ]);

  const filter = dateRangeMatch("createdAt", {
    gte: new Date("2026-10-01T00:00:00Z"),
    lt: new Date("2026-11-01T00:00:00Z"),
  });
  const matched = await col.find(filter).toArray();
  assert.deepEqual(
    matched.map((m) => m.code).sort(),
    ["D_NEW", "S_NEW"]
  );
  assert.equal(toIsoString(matched[0].createdAt), "2026-10-20T00:00:00.000Z");
  assert.equal(toIsoString(matched[1].createdAt), "2026-10-21T00:00:00.000Z");
});

test("buildOrderDoc writes BSON Date objects for purchaseDate, createdAt, updatedAt", () => {
  const doc = buildOrderDoc({
    orderDetails: [{ productCode: "P1", price: 100000, quantity: 2 }],
    subtotal: 200000,
    total: 200000,
    discount: 0,
    shippingFeeCharged: 0,
    deliveryMethod: "nhan_cua_hang",
    now: "2026-10-15T03:00:00Z",
  });
  assert.ok(doc.purchaseDate instanceof Date);
  assert.ok(doc.createdAt instanceof Date);
  assert.ok(doc.updatedAt instanceof Date);
  assert.equal(doc.createdAt.toISOString(), "2026-10-15T03:00:00.000Z");
});
