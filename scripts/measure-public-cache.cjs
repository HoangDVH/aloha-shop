const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const base = process.argv[2] || 'http://127.0.0.1:3001';
const output = process.argv[3] || 'artifacts/cache-baseline.json';
async function main() {
  const rows = [];
  for (const endpoint of ['/api/shop/appearance', '/api/shop/gifts', '/api/shop/gifts/nguoi-thuong', '/api/shop/category-tree']) {
    const samples = [];
    for (let i = 0; i < 12; i++) {
      const start = performance.now();
      const res = await fetch(base + endpoint, { signal: AbortSignal.timeout(15000) });
      const body = await res.arrayBuffer();
      samples.push({ ms: Math.round((performance.now() - start) * 10) / 10, status: res.status, cache: res.headers.get('x-shop-cache') || res.headers.get('x-cache'), bytes: body.byteLength });
    }
    const sorted = samples.map(s => s.ms).sort((a, b) => a - b);
    rows.push({ endpoint, medianMs: sorted[6], p95Ms: sorted[11], samples });
  }
  fs.writeFileSync(output, JSON.stringify({ base, at: new Date().toISOString(), rows }, null, 2));
  console.log(JSON.stringify(rows.map(({ endpoint, medianMs, p95Ms, samples }) => ({ endpoint, medianMs, p95Ms, statuses: [...new Set(samples.map(s => s.status))], cache: [...new Set(samples.map(s => s.cache))] })), null, 2));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
