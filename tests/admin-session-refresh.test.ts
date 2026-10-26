import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import http from "node:http";
import { registerAuthRoutes } from "../backend/auth/routes.js";
import {
  hashToken,
  newRefreshJti,
  signRefreshToken,
  REFRESH_COOKIE,
  ACCESS_COOKIE,
} from "../backend/auth/tokens.js";

// Mock DB in-memory for testing admin refresh logic
class MockDb {
  refreshTokens: any[] = [];
  users: any[] = [];

  collection(name: string) {
    if (name === "aloha_refresh_tokens") {
      return {
        findOne: async (query: any) => {
          if (query.jti) {
            return this.refreshTokens.find((r) => r.jti === query.jti) ?? null;
          }
          return null;
        },
        insertOne: async (doc: any) => {
          this.refreshTokens.push({ ...doc });
          return { insertedId: doc._id || "mock_refresh_id" };
        },
        updateOne: async (filter: any, update: any) => {
          const row = this.refreshTokens.find((r) => r.jti === filter.jti);
          if (row && update.$set) {
            Object.assign(row, update.$set);
          }
          return { modifiedCount: row ? 1 : 0 };
        },
        createIndex: async () => {},
      };
    }
    if (name === "users") {
      return {
        findOne: async (query: any) => {
          const sid = String(query.$or ? query.$or[0]._id : query._id || "");
          return this.users.find((u) => String(u._id) === sid || u.username === query.username) ?? null;
        },
      };
    }
    return {
      findOne: async () => null,
      insertOne: async () => ({}),
      updateOne: async () => ({}),
      createIndex: async () => {},
    };
  }
}

test("Admin Auth: /api/auth/refresh xoay token thành công và cấp cookie mới", async () => {
  const db = new MockDb();
  const testUser = {
    _id: "507f1f77bcf86cd799439011",
    username: "aloha",
    fullName: "Quản trị viên ALOHA",
    role: "manager",
    active: true,
  };
  db.users.push(testUser);

  const jti = newRefreshJti();
  const refreshToken = signRefreshToken({
    sub: testUser._id,
    username: testUser.username,
    role: "manager",
    jti,
  });

  db.refreshTokens.push({
    jti,
    userId: testUser._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date(),
  });

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  registerAuthRoutes(app, (async () => db) as any);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `${REFRESH_COOKIE}=${refreshToken}`,
        Origin: "http://localhost:3002",
      },
    });

    assert.equal(res.status, 200, "Phải trả về HTTP 200 khi refresh hợp lệ");
    const json = (await res.json()) as any;
    assert.equal(json.ok, true);
    assert.equal(json.user.username, "aloha");
    assert.equal(json.user.role, "manager");

    // Token cũ phải được đánh dấu đã xoay (revokedReason: 'rotated')
    const oldRow = db.refreshTokens.find((r) => r.jti === jti);
    assert.ok(oldRow?.revokedAt, "Token cũ phải có revokedAt");
    assert.equal(oldRow?.revokedReason, "rotated", "revokedReason phải là rotated");

    // Token mới phải được tạo trong DB
    assert.equal(db.refreshTokens.length, 2, "DB phải có 2 token (cũ đã thu hồi, mới active)");
  } finally {
    server.close();
  }
});

test("Admin Auth: /api/auth/refresh hỗ trợ Grace Period 60s cho 2 tab gửi cùng lúc", async () => {
  const db = new MockDb();
  const testUser = {
    _id: "507f1f77bcf86cd799439011",
    username: "aloha",
    fullName: "Quản trị viên ALOHA",
    role: "manager",
    active: true,
  };
  db.users.push(testUser);

  const jti = newRefreshJti();
  const refreshToken = signRefreshToken({
    sub: testUser._id,
    username: testUser.username,
    role: "manager",
    jti,
  });

  // Token vừa bị xoay cách đây 5 giây do Tab 1 gọi trước
  db.refreshTokens.push({
    jti,
    userId: testUser._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    revokedAt: new Date(Date.now() - 5000),
    revokedReason: "rotated",
    createdAt: new Date(),
  });

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  registerAuthRoutes(app, (async () => db) as any);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;

  try {
    // Tab 2 gửi request với token cũ trong vòng 60s grace period
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `${REFRESH_COOKIE}=${refreshToken}`,
        Origin: "http://localhost:3002",
      },
    });

    assert.equal(res.status, 200, "Trong grace period 60s phải thành công thay vì 401");
    const json = (await res.json()) as any;
    assert.equal(json.ok, true);
    assert.equal(json.user.username, "aloha");
  } finally {
    server.close();
  }
});

test("Admin Auth: /api/auth/refresh từ chối token đã đăng xuất (revokedReason: 'logout')", async () => {
  const db = new MockDb();
  const testUser = {
    _id: "507f1f77bcf86cd799439011",
    username: "aloha",
    fullName: "Quản trị viên ALOHA",
    role: "manager",
    active: true,
  };
  db.users.push(testUser);

  const jti = newRefreshJti();
  const refreshToken = signRefreshToken({
    sub: testUser._id,
    username: testUser.username,
    role: "manager",
    jti,
  });

  // Token bị thu hồi do đăng xuất
  db.refreshTokens.push({
    jti,
    userId: testUser._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    revokedAt: new Date(Date.now() - 2000),
    revokedReason: "logout",
    createdAt: new Date(),
  });

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  registerAuthRoutes(app, (async () => db) as any);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `${REFRESH_COOKIE}=${refreshToken}`,
        Origin: "http://localhost:3002",
      },
    });

    assert.equal(res.status, 401, "Token đã đăng xuất không được áp dụng grace period");
  } finally {
    server.close();
  }
});
