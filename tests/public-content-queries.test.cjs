const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, QueryObserver } = require('../frontend/node_modules/@tanstack/react-query');

function load(file, requireModule, extra = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(code, { exports, require: requireModule, ...extra });
  return exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const calls = [], client = new QueryClient();
  let version = 1, failed = false;
  const hooks = load('frontend/lib/publicContentQueries.ts', name => {
    if (name === '@tanstack/react-query') return { useQuery: options => options };
    if (name === './api') return { shopApiBase: () => '' };
    throw Error(name);
  }, { fetch: async url => {
    calls.push(url);
    await tick();
    return { ok: !failed, status: failed ? 503 : 200, json: async () => url.endsWith('/gifts')
      ? { ok: true, data: [{ slug: `gift-${version}` }] }
      : { theme: { siteName: `shop-${version}` }, blocks: [], version } };
  } });
  return { ...hooks, client, calls, update() { version++; }, fail(value) { failed = value; } };
}

test('header/footer/popup share one request; rerenders and fresh remounts reuse the cache', async () => {
  const f = fixture();
  try {
    const observers = Array.from({ length: 3 }, () => new QueryObserver(f.client, f.appearanceQueryOptions));
    const stop = observers.map(observer => observer.subscribe(() => {}));
    await f.client.fetchQuery(f.appearanceQueryOptions);
    for (let i = 0; i < 6; i++) await f.client.fetchQuery(f.appearanceQueryOptions);
    assert.equal(f.calls.length, 1);
    for (const observer of observers) assert.equal(observer.getCurrentResult().data.theme.siteName, 'shop-1');
    stop.forEach(unsubscribe => unsubscribe());
    const remount = new QueryObserver(f.client, f.appearanceQueryOptions);
    const unsubscribe = remount.subscribe(() => {});
    await tick(); assert.equal(f.calls.length, 1); unsubscribe();
  } finally { f.client.clear(); }
});

test('gifts do not refetch on render; an expired entry can refresh', async () => {
  const f = fixture();
  try {
    await Promise.all(Array.from({ length: 4 }, () => f.client.fetchQuery(f.giftsQueryOptions)));
    for (let i = 0; i < 6; i++) await f.client.fetchQuery(f.giftsQueryOptions);
    assert.equal(f.calls.length, 1);
    f.client.setQueryData(f.giftsQueryOptions.queryKey, [{ slug: 'old' }], { updatedAt: Date.now() - 60_001 });
    f.update();
    assert.equal((await f.client.fetchQuery(f.giftsQueryOptions))[0].slug, 'gift-2');
    assert.equal(f.calls.length, 2);
  } finally { f.client.clear(); }
});

test('one publish notification refetches each active content key once for all consumers', async () => {
  const f = fixture();
  try {
    const opts = [f.appearanceQueryOptions, f.appearanceQueryOptions, f.appearanceQueryOptions, f.giftsQueryOptions];
    const observers = opts.map(options => new QueryObserver(f.client, options));
    const stop = observers.map(observer => observer.subscribe(() => {}));
    await Promise.all([f.client.fetchQuery(f.appearanceQueryOptions), f.client.fetchQuery(f.giftsQueryOptions)]);
    f.update();
    await f.client.invalidateQueries({ queryKey: f.PUBLIC_CONTENT_KEY });
    assert.equal(f.calls.filter(url => url.endsWith('/appearance')).length, 2);
    assert.equal(f.calls.filter(url => url.endsWith('/gifts')).length, 2);
    assert.equal(observers[0].getCurrentResult().data.version, 2);
    assert.equal(observers[3].getCurrentResult().data[0].slug, 'gift-2');
    stop.forEach(unsubscribe => unsubscribe());
  } finally { f.client.clear(); }
});

test('failed loads do not cache a successful empty response and can recover', async () => {
  const f = fixture();
  try {
    f.fail(true);
    await assert.rejects(f.client.fetchQuery({ ...f.giftsQueryOptions, retry: false }), /503/);
    assert.equal(f.client.getQueryData(f.giftsQueryOptions.queryKey), undefined);
    f.fail(false);
    assert.equal((await f.client.fetchQuery(f.giftsQueryOptions))[0].slug, 'gift-1');
  } finally { f.client.clear(); }
});

test('server-provided gifts seed the query; absent or empty props do not seed a permanent empty cache', async () => {
  const f = fixture();
  try {
    const options = f.usePublicGifts([{ slug: 'seed' }]);
    const observer = new QueryObserver(f.client, options);
    const stop = observer.subscribe(() => {});
    assert.equal(observer.getCurrentResult().data[0].slug, 'seed');
    await tick(); assert.equal(f.calls.length, 0);
    stop();
    assert.equal(f.usePublicGifts().initialData, undefined);
    assert.equal(f.usePublicGifts([]).initialData, undefined);
  } finally { f.client.clear(); }
});

test('HomeGiftSection rerenders read a shared query and never issue direct fetch effects', () => {
  let queryCalls = 0;
  const jsx = () => ({});
  const component = load('frontend/components/gift/HomeGiftSection.tsx', name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useState: value => [value, () => {}], useRef: () => ({ current: null }),
      useMemo: fn => fn(), useEffect: () => {} };
    if (name === '@/lib/publicContentQueries') return { usePublicGifts() { queryCalls++; return { data: [] }; } };
    return {};
  }, { fetch() { assert.fail('Unexpected component fetch'); } });
  for (let i = 0; i < 6; i++) component.HomeGiftSection({});
  assert.equal(queryCalls, 6);
  for (const file of ['frontend/components/SiteChrome.tsx', 'frontend/components/ShopWelcomePopup.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /usePublicAppearance\(/);
    assert.doesNotMatch(source, /fetch\([^\n]*\/api\/shop\/appearance["`]/);
  }
});

test('one sync listener invalidates shared content and refreshes server-rendered content', () => {
  let handler, refreshed = 0, invalidated = 0, cleanup = 0;
  const component = load('frontend/components/ShopCatalogSync.tsx', name => {
    if (name === 'react') return { useEffect: fn => { const stop = fn(); if (stop) stop(); } };
    if (name === 'next/navigation') return { useRouter: () => ({ refresh() { refreshed++; } }), usePathname: () => '/' };
    if (name === '@tanstack/react-query') return { useQueryClient: () => ({ invalidateQueries() { invalidated++; return Promise.resolve(); } }) };
    if (name.endsWith('/publicContentQueries')) return { PUBLIC_CONTENT_KEY: ['shop_public_content'] };
    if (name.endsWith('/catalogSync')) return {
      startShopCatalogStream: () => () => {}, onShopCatalogChanged: () => () => {},
      onShopAppearanceChanged(fn) { handler = fn; return () => { cleanup++; }; },
    };
    if (name.endsWith('/cartPriceRefresh')) return {};
    throw Error(name);
  });
  component.ShopCatalogSync(); handler();
  assert.equal(refreshed, 1); assert.equal(invalidated, 1); assert.equal(cleanup, 1);
});

test('successful gift mutations invalidate server cache before publishing; missing rows do not publish', async () => {
  const events = [];
  let matched = 1;
  const repo = load('backend/shopGifts/giftRepo.ts', name => {
    if (name === 'mongodb') return { ObjectId: { isValid: () => false } };
    if (name.endsWith('/readCache.js')) return { publicReadCache: { invalidate: async key => { events.push(`invalidate:${key}`); } } };
    if (name.endsWith('/syncBus.js')) return { syncBus: { publish: (collections, source) => { events.push(`publish:${collections[0]}:${source}`); } } };
    if (name === './types.js') return { GIFT_COLLECTIONS_COL: 'aloha_gift_collections' };
    throw Error(name);
  });
  const db = { collection: () => ({ insertOne: async () => ({ insertedId: 'id' }),
    updateOne: async () => ({ matchedCount: matched }), deleteOne: async () => ({ deletedCount: matched }) }) };
  await repo.createGiftAdmin(db, { slug: 'test' });
  await repo.updateGiftAdmin(db, 'test', { title: 'Updated' });
  await repo.deleteGiftAdmin(db, 'test');
  assert.deepEqual(events, ['invalidate:gifts', 'publish:aloha_gift_collections:shop-gifts:create',
    'invalidate:gifts', 'publish:aloha_gift_collections:shop-gifts:update',
    'invalidate:gifts', 'publish:aloha_gift_collections:shop-gifts:delete']);
  matched = 0;
  await repo.updateGiftAdmin(db, 'missing', {}); await repo.deleteGiftAdmin(db, 'missing');
  assert.equal(events.length, 6);
});

test('gift changes reach existing storefront content listeners over SSE and clean up on close', () => {
  let onChange, cleaned = 0, route;
  const output = [], handlers = {};
  const routes = load('backend/shopCatalog/routes/stream.routes.ts', name => {
    if (name.endsWith('/cors.js')) return { setCors() {} };
    if (name.endsWith('/syncBus.js')) return { syncBus: {
      on(_, handler) { onChange = handler; }, off(_, handler) { assert.equal(handler, onChange); cleaned++; },
    } };
    throw Error(name);
  }, { setInterval: () => 1, clearInterval() {} });
  routes.registerCatalogStreamRoutes({ options() {}, get(_, handler) { route = handler; } }, {});
  route({ on(event, handler) { handlers[event] = handler; } }, { setHeader() {}, flushHeaders() {}, write(text) { output.push(text); } });
  onChange({ collections: ['aloha_gift_collections'], source: 'shop-gifts:update' });
  assert.match(output.join(''), /event: appearance\ndata: .*shop-gifts:update/);
  handlers.close(); assert.equal(cleaned, 1);
});
