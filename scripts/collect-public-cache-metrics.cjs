// Passive, bounded snapshot: no public cache-warming requests or customer data.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
require('dotenv').config({ quiet: true });
function redis(port) {
  const text = execFileSync('redis-cli', ['-h', '127.0.0.1', '-p', String(port), 'INFO'], { encoding: 'utf8', timeout: 5000 });
  const allowed = ['uptime_in_seconds', 'used_memory', 'maxmemory', 'maxmemory_policy', 'evicted_keys', 'keyspace_hits', 'keyspace_misses', 'rejected_connections'];
  return Object.fromEntries(text.split(/\r?\n/).map(line => line.split(':')).filter(([key]) => allowed.includes(key)).map(([key, value]) => [key, /^\d+$/.test(value) ? Number(value) : value]));
}
async function main() {
  const token = process.env.CACHE_METRICS_TOKEN || process.env.INTERNAL_SYNC_SECRET;
  if (!token) throw new Error('Metrics credential not configured');
  const directory = process.env.CACHE_MONITOR_DIR || '/var/log/aloha-cache-monitor';
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const row = { at: new Date().toISOString(), host: { load: os.loadavg(), freeMemory: os.freemem(), totalMemory: os.totalmem() } };
  const warnings = [];
  try {
    const response = await fetch('http://127.0.0.1:3001/api/shop/cache/metrics', { headers: { 'x-internal-key': token }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    row.api = await response.json();
  } catch { warnings.push('api_metrics_unavailable'); }
  row.redis = {};
  for (const port of [6379, 6380]) {
    try {
      row.redis[port] = redis(port);
      if (row.redis[port].used_memory > row.redis[port].maxmemory * 0.85) warnings.push(`redis_${port}_memory_above_85pct`);
    } catch { warnings.push(`redis_${port}_unavailable`); }
  }
  try {
    row.processes = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', timeout: 5000, maxBuffer: 2_000_000 }))
      .filter(p => ['aloha-shop-api', 'aloha-shop'].includes(p.name))
      .map(p => ({ name: p.name, pid: p.pid, status: p.pm2_env.status, restartCount: p.pm2_env.restart_time, cpu: p.monit.cpu, memory: p.monit.memory }));
    if (row.processes.some(p => p.status !== 'online')) warnings.push('shop_process_not_online');
  } catch { warnings.push('process_metrics_unavailable'); }
  const output = path.join(directory, 'samples.jsonl');
  let previous;
  try {
    const fd = fs.openSync(output, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const tail = Buffer.alloc(Math.min(size, 65536));
      fs.readSync(fd, tail, 0, tail.length, size - tail.length);
      previous = JSON.parse(tail.toString().trim().split('\n').at(-1));
    } finally { fs.closeSync(fd); }
  } catch { /* First sample or rotated log. */ }
  if (previous?.api?.requests?.startedAt === row.api?.requests?.startedAt && row.api?.groups) {
    for (const [name, group] of Object.entries(row.api.groups)) {
      const old = previous.api.groups[name] || {};
      const bypass = group.bypass - (old.bypass || 0);
      const reads = bypass + group.hit - (old.hit || 0) + group.miss - (old.miss || 0);
      if (reads >= 20 && bypass / reads > 0.1) warnings.push(`${name}_cache_bypass_above_10pct`);
    }
    for (const [name, route] of Object.entries(row.api.requests.routes)) {
      const old = previous.api.requests.routes[name] || {};
      if (route.errors > (old.errors || 0)) warnings.push(`${name}_http_5xx`);
    }
  }
  if (previous?.redis?.[6380]?.uptime_in_seconds <= row.redis[6380]?.uptime_in_seconds &&
      row.redis[6380]?.evicted_keys > (previous.redis[6380].evicted_keys || 0)) warnings.push('cache_evictions_increased');
  row.warnings = warnings;
  fs.appendFileSync(output, JSON.stringify(row) + '\n', { mode: 0o600 });
  if (warnings.length) console.error('Cache monitor: ' + warnings.join(', '));
  else console.log('Cache monitor snapshot saved');
}
main().catch(() => { console.error('Cache monitor collection failed'); process.exitCode = 1; });
