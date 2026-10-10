const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

test('cache transport reads env after import and bounds an unresponsive command', async () => {
  const original = process.env.CACHE_REDIS_URL;
  const flag = process.env.SHOP_PUBLIC_CACHE_ENABLED;
  delete process.env.CACHE_REDIS_URL;
  delete process.env.SHOP_PUBLIC_CACHE_ENABLED;
  let config;
  const client = {
    isReady: false, isOpen: false,
    on() {},
    async connect() { this.isOpen = true; this.isReady = true; },
    async disconnect() { this.isOpen = false; this.isReady = false; },
  };
  const exported = {};
  const compiled = ts.transpileModule(fs.readFileSync('backend/cache/transport.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports', 'require', compiled)(exported, () => ({ createClient: options => { config = options; return client; } }));
  try {
    assert.equal(await exported.cacheCommand(async () => 'wrong'), null);
    process.env.CACHE_REDIS_URL = 'redis://127.0.0.1:6380';
    assert.equal(await exported.cacheCommand(async () => 'ready'), 'ready');
    assert.equal(config.url, process.env.CACHE_REDIS_URL);
    assert.equal(config.disableOfflineQueue, true);
    const started = Date.now();
    assert.equal(await exported.cacheCommand(() => new Promise(() => {})), null);
    assert.ok(Date.now() - started < 1000);
    assert.equal(client.isReady, false);
    assert.equal(await exported.cacheCommand(async () => 'retry too soon'), null);
  } finally {
    if (original === undefined) delete process.env.CACHE_REDIS_URL; else process.env.CACHE_REDIS_URL = original;
    if (flag === undefined) delete process.env.SHOP_PUBLIC_CACHE_ENABLED; else process.env.SHOP_PUBLIC_CACHE_ENABLED = flag;
  }
});
