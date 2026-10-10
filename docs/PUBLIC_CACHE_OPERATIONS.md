# Public response cache — production rollout 10/10/2026

Mongo remains authoritative. No collection was migrated or deleted.

## Instances and configuration

- Coordination/auth: existing Redis `127.0.0.1:6379`, 128 MiB, now `noeviction`.
- Disposable cache: Redis `127.0.0.1:6380`, 64 MiB, `allkeys-lru`, no disk persistence, service `redis-shop-cache`, enabled at boot.
- `REDIS_URL` remains unchanged. `CACHE_REDIS_URL` selects only the cache instance. Without it, reads bypass cache and use Mongo.
- `SHOP_PUBLIC_CACHE_ENABLED=0` disables response caching after API restart. It does not disable OAuth, locks or rate limiting.
- `CACHE_METRICS_TOKEN` protects `GET /api/shop/cache/metrics` via `x-internal-key`. Do not log this token. Unauthenticated requests return 401.

## Cached data

- Catalog/category tree/facets/bestseller aggregates: existing TTLs (default catalog 300 seconds, bestsellers 60), price mode remains part of the cache scope.
- Published appearance response: 15 seconds. No draft, history or private admin payload. Publish/revert/migration/scheduled-publish hooks invalidate it.
- Active gift definitions: 60 seconds. List and detail share this bounded key; product price/stock/visibility are loaded separately on each detail request. Create/update/delete hooks invalidate definitions.
- Actual TTL includes 0–10% downward jitter. Old generation data expires naturally.
- Random generation IDs prevent evicted epoch keys from resurrecting old data. Lua rejects fills from before invalidation. Invalidations first follow the committed Mongo write.
- Cache commands/connect are bounded to 200ms per operation; offline commands are not queued; retry backoff is 5 seconds. A timeout or outage causes Mongo bypass. Failed local invalidation blocks reuse for 10 minutes.
- In-process coalescing is bounded to 512 pending keys. Disposable distributed fill locks wait briefly (up to 150ms plus bounded operations); long fills fall back to a DB read. These cache locks do not govern inventory or payment.
- Response payloads over 2 MB are not cached. No persistent RAM fallback is used for these responses, avoiding divergence across API processes.

## Verification

- 12 automated checks: 8 read-cache cases, 3 gift filter cases, 1 transport startup/deadline case. Backend/frontend typechecks and changed-file line checks passed.
- Production smoke verified real Redis MISS/HIT, same public response across miss/hit, TTL expiry, gift write invalidation with a fake DB (no Mongo writes), live product payload and authenticated metrics.
- Stopped only Redis cache `6380`: appearance/gifts/category-tree returned HTTP 200 BYPASS; coordination `6379` remained available. Restarted cache: it recovered to HIT.
- Observed cache memory approximately 1.22 MiB, 0 evictions; sampled Redis counters 62 hits/14 misses. Counters include cache housekeeping, not a per-route conversion rate.
- These are short smoke/load samples, not sustained traffic benchmarks. Small remote HTTP samples do not show a consistent latency improvement for every endpoint. Benefit confirmed here is avoiding repeated document queries while serving coherent responses.

## Measurement and monitoring

Run `node scripts/measure-public-cache.cjs <origin> <output.json>` for a small 12-request-per-endpoint sample. The first request includes connection warmup; do not interpret its p95 as a sustained load benchmark.

For production operations, inspect `redis-cli -p 6380 INFO memory`, `INFO stats`, the protected cache metrics endpoint and `systemctl status redis-shop-cache`. Watch eviction, unexpected bypass, producer time, API latency and coordination Redis memory approaching 128 MiB. Counters reset on API/Redis restarts.

## Rollback

Backup from this rollout: `/root/aloha-cache-backups/20261010T075607Z`.

Run `bash /root/aloha-cache-backups/20261010T075607Z/rollback.sh`. It restores the six original backend files, original `.env`, original Redis configuration and policy, then restarts only `aloha-shop-api`. Newly added cache modules/service may remain installed but restored backend does not use them. This avoids deleting files/services during recovery.

The initial release was a targeted patch applied to the running production checkout. The follow-up canonical Git release includes backend/cache, invalidation hooks, operations scripts and tests, with no local frontend changes. The release package and rollback backup remain available. Rollback restores the initial pre-cache backend even after the canonical Git release; a later deploy will re-enable cache unless the release is reverted in Git or `SHOP_PUBLIC_CACHE_ENABLED=0` is set.

## Continuous measurement

`bash scripts/install-cache-monitor.sh` installs a systemd timer every five minutes. It reads the protected local metrics endpoint, Redis counters and selected PM2 status fields. It does not warm caches, collect customer data, or log credentials. Snapshots live in `/var/log/aloha-cache-monitor/samples.jsonl` (root-only); logrotate keeps seven daily rotations.

HTTP histograms measure actual completed GET requests for appearance, gifts and catalog, including cache and DB time. Latency buckets are approximate upper bounds, not exact percentiles. Cache read counters are distinct from HTTP request counts. `node scripts/report-public-cache-metrics.cjs` calculates counter deltas, excludes restart boundaries and reports p50/p95 bucket bounds, cache hit rates, errors and warnings. A week of observation must elapse before interpreting this as a seven-day benchmark.

Inspect `journalctl -u aloha-cache-monitor.service` for warnings: API/process availability, Redis memory above 85%, increasing evictions, new HTTP 5xx, or cache bypass above 10% for intervals with at least 20 cache reads. These are local operational warnings, not external notifications. Stop collection with `systemctl disable --now aloha-cache-monitor.timer`; the metrics middleware records only fixed, bounded route groups.

## Bestseller invoice indexes

Run `node scripts/audit-bestseller-indexes.cjs <output.json>` read-only. The explicit `--apply` option creates three non-unique indexes on `aloha_sales_invoices`: `shop_bestsellers_purchaseDate_v1`, `shop_bestsellers_createdDate_v1`, and `shop_bestsellers_createdAt_v1`. All three branches of the existing date OR query need an index; invoice documents and ranking logic are unchanged.

On 10 October, executionStats for the exact 90-day pipeline changed from COLLSCAN (23,932 documents, 76ms) to indexed OR (498 documents, 1,494 keys, 11ms). Both runs returned the same 530 product revenue totals; SHA-256 of sorted results matched. The all-history fallback still reads all invoices (317/328ms in this sample) and returns the same 3,000 totals. These timings are individual diagnostic samples, not production HTTP percentiles. The index design follows [MongoDB aggregation optimization](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/).

Indexes are an explicit migration, not rebuilt at API startup. If rollback requires dropping them, first verify their names and other consumers; dropping an index is separate from the cache rollback script.

## Reproducible scripts

- `scripts/deploy-public-cache.sh`: guarded first installation; validates patch, snapshots original files/config, automatically rolls back an installation failure. It intentionally refuses to overwrite an existing cache installation.
- `scripts/smoke-public-cache.cjs`: real Redis/read-only API verification; gift write hook uses a fake DB, never mutates Mongo.
- `scripts/smoke-public-cache-outage.sh`: briefly stops only the cache service, asserts HTTP 200 BYPASS, automatically restores service, verifies recovery. Run during an approved maintenance/test window.
