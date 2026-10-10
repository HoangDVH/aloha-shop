const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const frontendRequire = Module.createRequire(path.resolve('frontend/package.json'));
const React = frontendRequire('react');
const { renderToString } = frontendRequire('react-dom/server');
const query = frontendRequire('@tanstack/react-query');

function load(relative, overrides = {}) {
  const filename = path.resolve('frontend', relative);
  const module = new Module(filename);
  module.require = id => {
    if (id in overrides) return overrides[id];
    if (id === 'react' || id === 'react/jsx-runtime' || id === '@tanstack/react-query') return frontendRequire(id);
    if (id === 'next/navigation') return { usePathname: () => '/admin', useRouter: () => ({ replace() {} }) };
    if (id.endsWith('/adminFetch')) return { adminKeys: { me: ['admin', 'me'] }, adminFetch: () => Promise.resolve(null), AdminApiError: class extends Error {} };
    if (id.endsWith('useHydratedQuery')) return load('lib/useHydratedQuery.ts');
    return new Proxy({}, { get: () => () => Promise.resolve(null) });
  };
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return module.exports;
}

test('a late account consumer keeps its server snapshot even after the parent provider is ready', () => {
  const ready = { user: { id: 'buyer', fullName: 'Buyer' }, loading: false, authBusy: true, authAction: 'login', logout() {} };
  const { useShopAuth } = load('components/ShopAuthProvider.tsx', { react: { ...React, useContext: () => ready } });
  function Probe() {
    const session = useShopAuth();
    assert.equal(session.logout, ready.logout);
    return React.createElement('span', null, session.loading && !session.user && !session.authBusy && session.authAction === null ? 'pending' : 'buyer');
  }
  assert.equal(renderToString(React.createElement(Probe)), '<span>pending</span>');
  assert.equal(ready.user.id, 'buyer');
});

test('after hydration the original query result is returned, including errors and refetch', () => {
  const result = { data: { id: 'buyer' }, isLoading: false, error: new Error('network'), refetch() {} };
  const { useHydratedQuery } = load('lib/useHydratedQuery.ts', { react: { ...React, useSyncExternalStore: () => true } });
  assert.equal(useHydratedQuery(result), result);
});

test('Google login renders the same href with and without a browser origin', () => {
  const auth = load('lib/auth.ts');
  const before = global.window;
  try {
    delete global.window;
    const server = auth.googleStartUrl('/gio-hang');
    global.window = { location: { origin: 'https://shop.example.com' } };
    assert.equal(auth.googleStartUrl('/gio-hang'), server);
    assert.equal(server, '/api/shop/auth/google/start?next=%2Fgio-hang');
    assert.match(auth.googleStartUrl('/gio-hang', 'https://shop.example.com'), /origin=https%3A%2F%2Fshop.example.com/);
  } finally { if (before === undefined) delete global.window; else global.window = before; }
});

test('Google button keeps its server href during hydration even in a browser', () => {
  const before = global.window;
  try {
    global.window = { location: { origin: 'https://shop.example.com' } };
    const { GoogleAuthButton } = load('components/GoogleAuthButton.tsx');
    const html = renderToString(React.createElement(GoogleAuthButton, { href: '/api/shop/auth/google/start?next=%2F', label: 'Google' }));
    assert.match(html, /href="\/api\/shop\/auth\/google\/start\?next=%2F"/);
    assert.doesNotMatch(html, /origin=/);
  } finally { if (before === undefined) delete global.window; else global.window = before; }
});

test('disabled wallet with cached vouchers also keeps its server loading snapshot', () => {
  const client = new query.QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const cached = { claimedIds: ['saved'] };
  client.setQueryData(['shop', 'vouchers', 'wallet'], cached);
  const { useWallet } = load('lib/campaign/walletQueries.ts');
  function Probe() {
    const result = useWallet(false);
    return React.createElement('span', null, result.isLoading && result.data === undefined ? 'pending' : 'wallet');
  }
  assert.equal(renderToString(React.createElement(query.QueryClientProvider, { client }, React.createElement(Probe))), '<span>pending</span>');
  assert.equal(client.getQueryData(['shop', 'vouchers', 'wallet']), cached);
  client.clear();
});

const cases = [
  ['account', 'lib/authQueries.ts', 'useShopMeQuery', ['shop', 'auth', 'me'], { id: 'test', fullName: 'Buyer' }],
  ['wallet', 'lib/campaign/walletQueries.ts', 'useWallet', ['shop', 'vouchers', 'wallet'], { items: [], claimedIds: ['voucher'] }],
  ['wholesale', 'lib/siQueries.ts', 'useSiSession', ['shop', 'si', 'session'], { verified: true, user: { id: 'test' } }],
  ['admin', 'components/admin/auth/useAdminSession.ts', 'useAdminSession', ['admin', 'me'], { user: { role: 'manager', username: 'admin' } }],
];
for (const [name, file, hookName, key, cached] of cases) {
  for (const value of [undefined, null, cached]) {
    test(`${name}: initial HTML stays pending with ${value === undefined ? 'empty' : value === null ? 'guest' : 'warm'} cache`, () => {
      const client = new query.QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
      if (value !== undefined) client.setQueryData(key, value);
      const hook = load(file)[hookName];
      function Probe() {
        const session = hook();
        const result = name === 'admin' ? { isLoading: session.loading, isPending: session.loading, data: session.user || undefined, isError: Boolean(session.error) } : session;
        return React.createElement('span', null, JSON.stringify({
          loading: result.isLoading, pending: result.isPending,
          dataHidden: result.data === undefined, error: result.isError,
        }));
      }
      const html = renderToString(React.createElement(query.QueryClientProvider, { client }, React.createElement(Probe)));
      assert.equal(html, '<span>{&quot;loading&quot;:true,&quot;pending&quot;:true,&quot;dataHidden&quot;:true,&quot;error&quot;:false}</span>');
      assert.equal(client.getQueryData(key), value);
      client.clear();
    });
  }
}
