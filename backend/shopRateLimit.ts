/**
 * Rate limit IP nhẹ cho shop (memory) — không đụng Mongo catalog.
 */
type Bucket = { n: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export function clientIpFromReq(req: {
  headers: { [k: string]: string | string[] | undefined };
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0]!.trim();
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).split(",")[0]!.trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * @returns true nếu còn trong hạn mức; false nếu vượt → caller trả 429
 */
export function rateLimitAllow(
  key: string,
  max: number,
  windowMs: number
): boolean {
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

export function shopRateLimitOrReject(
  req: {
    headers: { [k: string]: string | string[] | undefined };
    ip?: string;
    socket?: { remoteAddress?: string };
  },
  res: { status: (n: number) => { json: (b: unknown) => unknown } },
  scope: string,
  max: number,
  windowMs: number
): boolean {
  const ip = clientIpFromReq(req);
  if (rateLimitAllow(`${scope}:${ip}`, max, windowMs)) return true;
  res.status(429).json({ error: "Quá nhiều yêu cầu — thử lại sau", code: "rate_limited" });
  return false;
}
