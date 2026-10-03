/**
 * Rate limit — Redis INCR+EXPIRE (chuẩn multi-instance);
 * local không REDIS_URL → memory fallback.
 * (docs/KE_HOACH_CHONG_LAM_DUNG_UU_DAI_KHONG_OTP.md mục 8, AB28, AB29, AB30)
 */
import { redisIncr } from "./redis.js";

type Bucket = { n: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

function memoryAllow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  prune(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { n: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.n >= max) return false;
  b.n += 1;
  return true;
}

/**
 * Lấy IP khách hàng.
 * Chỉ tin X-Forwarded-For khi được cấu hình proxy tin cậy (TRUST_PROXY=1) (mục 8, AB28).
 * Nếu không tin proxy, tuyệt đối không dùng header do client tự gửi để tránh né rate limit.
 */
export function clientIpFromReq(req: {
  headers: { [k: string]: string | string[] | undefined };
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  const trustProxy =
    process.env.TRUST_PROXY === "1" ||
    process.env.TRUST_PROXY === "true" ||
    process.env.NODE_ENV === "production_trusted_proxy";

  if (trustProxy) {
    const xf = req.headers["x-forwarded-for"];
    if (typeof xf === "string" && xf.trim()) return xf.split(",")[0]!.trim();
    if (Array.isArray(xf) && xf[0]) return String(xf[0]).split(",")[0]!.trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * @returns true nếu còn trong hạn mức; false nếu vượt → caller trả 429
 */
export async function rateLimitAllow(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const n = await redisIncr(`aloha:rl:${key}`, ttlSec);
    if (n != null) return n <= max;
  } catch (err) {
    console.warn("[rate-limit] Redis error, fallback to memory", err);
  }
  return memoryAllow(key, max, windowMs);
}

/**
 * Rate limit theo key cụ thể (IP hoặc AccountId) kèm header Retry-After (mục 8, AB29).
 */
export async function checkRateLimitOrReject(
  key: string,
  res: {
    status: (n: number) => { json: (b: unknown) => unknown };
    setHeader?: (k: string, v: string) => unknown;
  },
  max: number,
  windowMs: number
): Promise<boolean> {
  if (await rateLimitAllow(key, max, windowMs)) {
    return true;
  }
  const retryAfterSec = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    if (typeof res.setHeader === "function") {
      res.setHeader("Retry-After", String(retryAfterSec));
    }
  } catch {}
  res.status(429).json({
    error: `Quá nhiều yêu cầu — vui lòng thử lại sau ${retryAfterSec} giây`,
    code: "rate_limited",
    retryAfter: retryAfterSec,
  });
  return false;
}

export async function shopRateLimitOrReject(
  req: {
    headers: { [k: string]: string | string[] | undefined };
    ip?: string;
    socket?: { remoteAddress?: string };
    shopAuth?: { userId?: string };
  },
  res: {
    status: (n: number) => { json: (b: unknown) => unknown };
    setHeader?: (k: string, v: string) => unknown;
  },
  scope: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const ip = clientIpFromReq(req);
  const accountId = req.shopAuth?.userId;
  // Kết hợp accountId nếu đã đăng nhập để rate limit theo tài khoản (mục 8)
  const key = accountId ? `${scope}:acc:${accountId}` : `${scope}:ip:${ip}`;
  return checkRateLimitOrReject(key, res, max, windowMs);
}
