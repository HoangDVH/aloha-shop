import type { RequestHandler } from 'express';

export const LATENCY_BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const startedAt = new Date().toISOString();
const counters = new Map<string, { count: number; errors: number; totalMs: number; buckets: number[] }>();
export function recordRequest(route: string, ms: number, status: number) {
  let row = counters.get(route);
  if (!row) {
    row = { count: 0, errors: 0, totalMs: 0, buckets: Array(LATENCY_BUCKETS_MS.length + 1).fill(0) };
    counters.set(route, row);
  }
  row.count++;
  row.errors += status >= 500 ? 1 : 0;
  row.totalMs += ms;
  const index = LATENCY_BUCKETS_MS.findIndex(bound => ms <= bound);
  row.buckets[index < 0 ? LATENCY_BUCKETS_MS.length : index]++;
}
export function requestMetrics() {
  return { startedAt, boundsMs: [...LATENCY_BUCKETS_MS, null], routes: Object.fromEntries(
    [...counters].map(([key, value]) => [key, { ...value, buckets: [...value.buckets] }]),
  ) };
}
export const measurePublicRequests: RequestHandler = (req, res, next) => {
  // Fixed groups: no query strings, product codes, user IDs or unbounded labels.
  const route = req.method !== 'GET' ? null :
    req.path === '/api/shop/appearance' ? 'appearance' :
    req.path === '/api/shop/gifts' || req.path.startsWith('/api/shop/gifts/') ? 'gifts' :
    /^\/api\/shop\/(products|categories|category-tree|facets)(\/|$)/.test(req.path) ? 'catalog' : null;
  if (route) {
    const start = performance.now();
    res.once('finish', () => recordRequest(route, performance.now() - start, res.statusCode));
  }
  next();
};
