/**
 * backend/shopOrders/kvCustomerResolver.ts
 * ============================================================
 * Tra cứu hoặc tạo nhanh hồ sơ Khách hàng trên KiotViet cho khách lẻ.
 * Chuẩn Enterprise:
 * - Ưu tiên đọc kvCustomerId sẵn từ database (0ms overhead lúc checkout).
 * - Tra cứu KiotViet theo SĐT trước khi tạo để tránh trùng lặp.
 * - Tuyệt đối không thay đổi hay can thiệp vào tài khoản/nhóm Khách Sỉ.
 * - Bọc timeout và soft-fail: không bao giờ làm gián đoạn hay lỗi luồng đặt hàng.
 * ============================================================
 */
import type { Db } from "mongodb";
import {
  fetchKvAccessToken,
  kvApiBase,
  loadKvCreds,
} from "../services/kvApiClient.js";
import { resolveShopKvBranchId } from "./kvPush.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";

export function normalizeCustomerPhone(raw: unknown): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
  return normalized.length >= 9 && normalized.length <= 11 ? normalized : "";
}

export type ResolveKvCustomerOpts = {
  shopDb: Db;
  opsDb: Db;
  accountId?: string | null;
  phone: string;
  fullName?: string;
  address?: string;
  timeoutMs?: number;
};

/**
 * Đảm bảo khách hàng có kvCustomerId trên KiotViet.
 * Trả về customerId (number) nếu thành công, hoặc null nếu không giải quyết được / timeout.
 */
export async function resolveKvCustomerIdForAccount(
  opts: ResolveKvCustomerOpts
): Promise<number | null> {
  const { shopDb, opsDb, accountId, phone, fullName, address } = opts;
  const timeoutMs = opts.timeoutMs ?? 2500;

  // 1. Kiểm tra tài khoản trong database trước
  if (accountId) {
    try {
      const account = await shopDb
        .collection(SHOP_ACCOUNTS)
        .findOne(shopAccountIdQuery(accountId));
      if (account?.kvCustomerId && Number(account.kvCustomerId) > 0) {
        return Number(account.kvCustomerId);
      }
      // Bảo vệ khách sỉ: Tài khoản sỉ được quản lý riêng bởi module wholesale provision
      if (account?.roles?.includes("si") || account?.siStatus === "active") {
        return null;
      }
    } catch {
      /* Bỏ qua lỗi đọc Mongo tạm thời, tiếp tục thử giải quyết */
    }
  }

  const phoneNorm = normalizeCustomerPhone(phone);
  if (!phoneNorm) return null;

  try {
    const creds = await loadKvCreds(opsDb);
    if (!creds) return null;

    const token = await fetchKvAccessToken(creds);
    const headers = {
      Authorization: `Bearer ${token}`,
      Retailer: creds.retailer,
      "Content-Type": "application/json",
    };
    const api = kvApiBase();

    // 2. Tra cứu khách hàng theo SĐT trên KiotViet
    let customerId: number | null = null;
    let customerCode: string | null = null;

    try {
      const searchRes = await fetch(
        `${api}/customers?contactNumber=${encodeURIComponent(phoneNorm)}&pageSize=20`,
        {
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        }
      );
      if (searchRes.ok) {
        const json = await searchRes.json().catch(() => null);
        const list = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];
        const match = list.find((c: any) => {
          const cPhone = normalizeCustomerPhone(c?.contactNumber);
          return cPhone === phoneNorm && c?.isActive !== false;
        }) || list.find((c: any) => normalizeCustomerPhone(c?.contactNumber) === phoneNorm);

        if (match && Number(match.id) > 0) {
          customerId = Number(match.id);
          customerCode = String(match.code || "");
        }
      }
    } catch (e: any) {
      console.warn("[kvCustomerResolver] lookup warning:", e?.message || e);
    }

    // 3. Nếu chưa tồn tại trên KiotViet, gọi POST /customers để tạo mới
    if (!customerId) {
      try {
        const branchId = await resolveShopKvBranchId(creds, token);
        const createRes = await fetch(`${api}/customers`, {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            name: String(fullName || "Khách web").trim() || "Khách web",
            contactNumber: phoneNorm,
            address: address ? String(address).slice(0, 255) : undefined,
            branchId,
            comments: "Khách hàng Aloha Web",
          }),
        });

        if (createRes.ok) {
          const body = await createRes.json().catch(() => null);
          const data = body?.data ?? body;
          const id = Number(data?.id);
          if (id > 0) {
            customerId = id;
            customerCode = String(data?.code || "");
          }
        } else if (createRes.status === 400) {
          // Trường hợp SĐT vừa xuất hiện / trùng lặp: thử query lại 1 lần
          const retryRes = await fetch(
            `${api}/customers?contactNumber=${encodeURIComponent(phoneNorm)}&pageSize=10`,
            {
              headers,
              signal: AbortSignal.timeout(2000),
            }
          );
          if (retryRes.ok) {
            const retryJson = await retryRes.json().catch(() => null);
            const retryList = Array.isArray(retryJson?.data) ? retryJson.data : [];
            const retryMatch = retryList.find(
              (c: any) => normalizeCustomerPhone(c?.contactNumber) === phoneNorm
            );
            if (retryMatch && Number(retryMatch.id) > 0) {
              customerId = Number(retryMatch.id);
              customerCode = String(retryMatch.code || "");
            }
          }
        }
      } catch (e: any) {
        console.warn("[kvCustomerResolver] create warning:", e?.message || e);
      }
    }

    // 4. Lưu lại kvCustomerId vào tài khoản người dùng để tối ưu 0ms cho các lần mua sau
    if (customerId && accountId) {
      try {
        await shopDb.collection(SHOP_ACCOUNTS).updateOne(
          {
            ...shopAccountIdQuery(accountId),
            kvCustomerId: { $in: [null, undefined] },
            roles: { $ne: "si" }, // Không ghi đè nếu tài khoản đã là sỉ
          },
          {
            $set: {
              kvCustomerId: customerId,
              ...(customerCode ? { kvCustomerCode: customerCode } : {}),
              updatedAt: new Date(),
            },
          }
        );
      } catch (e: any) {
        console.warn("[kvCustomerResolver] save to account warning:", e?.message || e);
      }
    }

    return customerId;
  } catch (error: any) {
    console.warn("[kvCustomerResolver] soft-fail error:", error?.message || error);
    return null;
  }
}
