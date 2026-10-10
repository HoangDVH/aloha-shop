const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const frontendRequire = Module.createRequire(path.resolve('frontend/package.json'));
const React = frontendRequire('react');
const { renderToString } = frontendRequire('react-dom/server');

test('SSR keeps the loading shell even when the campaign query cache is populated', () => {
  const filename = path.resolve('frontend/components/campaign/deals/DealsPage.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = new Module(filename);
  module.require = id => {
    if (id === 'react' || id === 'react/jsx-runtime') return frontendRequire(id);
    if (id === 'next/navigation') return { usePathname: () => '/uu-dai', useSearchParams: () => new URLSearchParams() };
    if (id.endsWith('/useCampaignView')) return { useCampaignView: () => ({ loading: false, campaign: { products: [], display: { colors: { primary: '#C2185B', cream: '#FFF0F5' } } }, vouchers: [] }) };
    if (id.endsWith('/dealsTabs')) return { toDealsTab: () => null };
    if (id.endsWith('/VoucherKindFilter')) return { toVoucherKind: () => 'all', filterVouchers: v => v };
    return new Proxy({}, { get: () => () => React.createElement('div', null, 'campaign-content') });
  };
  module._compile(compiled, filename);
  const html = renderToString(React.createElement(module.exports.DealsPage));
  assert.match(html, /animate-pulse/);
  assert.doesNotMatch(html, /campaign-content|--campaign-primary/);
});

test('shared campaign query hides warm browser cache from the initial hydration snapshot', () => {
  const filename = path.resolve('frontend/lib/campaign/campaignQueries.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const cached = { campaign: { id: 'active', display: { colors: { primary: '#C2185B' } } }, vouchers: [] };
  const module = new Module(filename);
  module.require = id => {
    if (id === 'react') return React;
    if (id === '@tanstack/react-query') return { useQuery: () => ({ data: cached, isLoading: false }), useQueryClient: () => ({ invalidateQueries() {} }) };
    if (id.endsWith('/catalogSync')) return { onShopCampaignChanged: () => () => {} };
    return { fetchCurrentCampaign() {} };
  };
  module._compile(compiled, filename);
  function Probe() {
    const query = module.exports.useCurrentCampaign();
    return React.createElement('span', null, query.isLoading && query.data === undefined ? 'loading' : 'campaign');
  }
  assert.equal(renderToString(React.createElement(Probe)), '<span>loading</span>');
  assert.equal(cached.campaign.id, 'active');
});
