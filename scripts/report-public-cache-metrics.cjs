const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
function summarize(rows) {
  const totals = {};
  let resets = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].api, b = rows[i].api;
    if (!a?.requests || !b?.requests) continue;
    if (a.requests.startedAt !== b.requests.startedAt) { resets++; continue; }
    for (const [name, current] of Object.entries(b.requests.routes)) {
      const old = a.requests.routes[name];
      const row = totals[name] ||= { count: 0, errors: 0, totalMs: 0, buckets: current.buckets.map(() => 0), hit: 0, miss: 0, bypass: 0 };
      for (const key of ['count', 'errors', 'totalMs']) row[key] += current[key] - (old?.[key] || 0);
      current.buckets.forEach((value, j) => row.buckets[j] += value - (old?.buckets[j] || 0));
      for (const key of ['hit', 'miss', 'bypass']) row[key] += (b.groups?.[name]?.[key] || 0) - (a.groups?.[name]?.[key] || 0);
    }
  }
  const bounds = rows.at(-1)?.api?.requests?.boundsMs || [];
  for (const row of Object.values(totals)) {
    const percentile = q => {
      if (!row.count) return null;
      let cumulative = 0;
      const index = row.buckets.findIndex(value => (cumulative += value) >= row.count * q);
      return bounds[index] ?? '>5000';
    };
    row.p50UpperMs = percentile(0.5);
    row.p95UpperMs = percentile(0.95);
    row.averageMs = row.count ? Math.round(row.totalMs / row.count * 100) / 100 : null;
    const reads = row.hit + row.miss + row.bypass;
    row.hitPercent = reads ? Math.round(row.hit / reads * 10000) / 100 : null;
  }
  return { samples: rows.length, first: rows[0]?.at, last: rows.at(-1)?.at, resets, totals,
    warnings: rows.filter(row => row.warnings?.length).map(row => ({ at: row.at, warnings: row.warnings })), latestRedis: rows.at(-1)?.redis };
}
if (require.main === module) {
  const directory = process.argv[2] || '/var/log/aloha-cache-monitor';
  const rows = fs.readdirSync(directory).filter(name => /^samples\.jsonl(\.\d+)?(\.gz)?$/.test(name)).flatMap(name => {
    const bytes = fs.readFileSync(path.join(directory, name));
    const text = (name.endsWith('.gz') ? zlib.gunzipSync(bytes) : bytes).toString();
    return text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  }).sort((a, b) => a.at.localeCompare(b.at));
  console.log(JSON.stringify(summarize(rows), null, 2));
}
module.exports = { summarize };
