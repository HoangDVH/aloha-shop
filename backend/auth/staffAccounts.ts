import type { Db } from "mongodb";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/** Tài khoản nhân viên dùng chung với app thu mua — shop CHỈ ĐỌC, không thêm/sửa field. */
export const STAFF_USERS = "users";
/** Trạng thái đăng nhập riêng của shop (đếm sai, khóa tạm, lần đăng nhập cuối) — _id = username. */
export const LOGIN_STATE = "aloha_login_state";

export const STAFF_READ_ONLY_MSG = "Tài khoản quản lý ở app thu mua — shop không tạo/sửa tài khoản.";

export type LoginState = {
  _id: string;
  failedLoginCount?: number;
  lockUntil?: Date | null;
  lastLoginAt?: Date;
};

export function isStaffActive(doc: Record<string, unknown>): boolean {
  return doc.active !== false && doc.isActive !== false;
}

function sameSecret(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Hỗ trợ cả hash bcrypt lẫn mật khẩu lưu thẳng (định dạng hiện tại của `users`). */
export async function verifyStaffPassword(input: string, doc: Record<string, unknown>): Promise<boolean> {
  const hash = String(doc.passwordHash || "");
  if (/^\$2[aby]\$\d{2}\$/.test(hash)) return bcrypt.compare(input, hash);
  const stored = String(doc.password ?? "");
  if (!stored) return false;
  if (/^\$2[aby]\$\d{2}\$/.test(stored)) return bcrypt.compare(input, stored);
  return sameSecret(input, stored);
}

export async function readLoginState(db: Db, username: string): Promise<LoginState | null> {
  return db.collection<LoginState>(LOGIN_STATE).findOne({ _id: username });
}

export async function writeLoginState(db: Db, username: string, patch: Omit<LoginState, "_id">) {
  await db.collection<LoginState>(LOGIN_STATE).updateOne({ _id: username }, { $set: patch }, { upsert: true });
}
