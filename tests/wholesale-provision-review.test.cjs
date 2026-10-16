const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('backend/shopWholesale/provision.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture(patch = {}, customers = []) {
  const account = { _id: 'u1', roles: ['si'], active: true, siStatus: 'active', siRegion: 'HCM', siIdentity: true,
    fullName: 'Account name', phoneNorm: '0901234567', siVerification: { status: 'pending' }, siProfile: { fullName: 'Contact name', shopName: 'Shop', district: 'District' }, ...patch };
  const get = (key) => key.split('.').reduce((value, part) => value?.[part], account);
  const matches = query => Object.entries(query).every(([key, value]) => {
    if (key === '$and') return value.every(matches);
    if (key === '$or') return value.some(matches);
    const actual = get(key);
    if (value === null) return actual == null;
    if (value && typeof value === 'object' && !(value instanceof Date)) return Object.entries(value).every(([op, v]) => {
      if (op === '$in') return v.includes(actual);
      if (op === '$exists') return (actual !== undefined) === v;
      if (op === '$ne') return actual !== v;
      if (op === '$lte') return actual <= v;
      throw Error(op);
    });
    return Array.isArray(actual) ? actual.includes(value) : actual === value;
  });
  function update(query, change) {
    if (!matches(query)) return { modifiedCount: 0 };
    Object.assign(account, change.$set);
    for (const key of Object.keys(change.$unset || {})) delete account[key];
    for (const [key, value] of Object.entries(change.$inc || {})) account[key] = (account[key] || 0) + value;
    return { modifiedCount: 1 };
  }
  const db = { collection: () => ({ findOneAndUpdate: async (q, u) => update(q, u).modifiedCount ? structuredClone(account) : null, updateOne: async (q, u) => update(q, u) }) };
  const sent = [];
  let rows = customers, lost = false, wrapped = false;
  const exports = {};
  vm.runInNewContext(source, { exports, Date, setInterval, AbortSignal,
    process: { env: { SHOP_SI_KV_PROVISION_ENABLED: '1', KV_GROUP_ID_SI_HCM: '1', KV_GROUP_ID_SI_TINH: '2' } },
    fetch: async (_url, opts) => {
      if (opts.method === 'POST') {
        const body = JSON.parse(opts.body); sent.push(body);
        if (lost) throw Error('network');
        const customer = { id: 5, code: 'KH005', contactNumber: account.phoneNorm, comments: body.comments };
        return { ok: true, json: async () => wrapped ? { data: customer } : customer };
      }
      return { ok: true, json: async () => rows[0] };
    },
    require(name) {
      if (name === 'node:crypto') return require(name);
      if (name.includes('shopAuth/models')) return { SHOP_ACCOUNTS: 'accounts' };
      if (name.includes('kvApiClient')) return { loadKvCreds: async () => ({ retailer: 'shop' }), fetchKvAccessToken: async () => 'test', kvApiBase: () => 'https://test.invalid' };
      if (name.includes('kvPush')) return { resolveShopKvBranchId: async () => 1 };
      if (name.includes('kvCustomers')) return { lookupKvCustomers: async () => ({ customers: rows, retailer: 'shop' }), verifyCustomerRegion: async () => null };
      if (name.includes('syncBus')) return { syncBus: { publish() {} } };
      if (name === './policy.js') return { normalizeWholesalePhone: value => String(value || '').replace(/\D/g, '') };
      throw Error(name);
    },
  });
  return { account, sent, run: () => exports.provisionWholesaleCustomer(db, {}, 'u1'),
    setCustomers: value => { rows = value; }, loseResponse: () => { lost = true; }, wrapResponse: () => { wrapped = true; } };
}

test('pending HCM and TINH accounts create one marked customer without approving their profile', async () => {
  for (const siRegion of ['HCM', 'TINH']) {
    const f = fixture({ siRegion });
    await Promise.all(Array.from({ length: 20 }, () => f.run()));
    assert.equal(f.sent.length, 1); assert.equal(f.account.kvCustomerId, 5);
    assert.match(f.sent[0].comments, /ALOHA_WS:u1/);
    assert.match(f.sent[0].comments, /chờ xác minh/);
    assert.equal(f.sent[0].name, 'Contact name');
    assert.match(f.sent[0].comments, /Cửa hàng: Shop/);
    assert.equal(f.account.siVerification.status, 'pending');
    assert.equal(f.sent[0].groupIds[0], siRegion === 'HCM' ? 1 : 2);
  }
});
test('unique exact-phone existing customer links without creating or changing its KV group', async () => {
  const f = fixture({}, [{ id: 5, code: 'KH005', contactNumber: '0901234567' }]);
  assert.equal((await f.run()).status, 'synced');
  assert.equal(f.sent.length, 0); assert.equal(f.account.kvCustomerId, 5);
});
test('customer POST response wrapped in data links the returned official customer', async () => {
  const f = fixture(); f.wrapResponse();
  assert.equal((await f.run()).status, 'synced');
  assert.equal(f.account.kvCustomerCode, 'KH005'); assert.equal(f.sent.length, 1);
});
test('duplicate matches or an unknown previous customer create never produce another POST', async () => {
  for (const f of [fixture({}, [{ id: 5 }, { id: 6 }]), fixture({ siKvCreateStartedAt: 'before' })]) {
    assert.equal((await f.run()).status, 'reconciling'); assert.equal(f.sent.length, 0);
  }
});
test('lost create response reconciles by marker without repeating the create', async () => {
  const f = fixture(); f.loseResponse();
  assert.equal((await f.run()).status, 'reconciling'); assert.equal(f.sent.length, 1);
  delete f.account.siKvSyncNextAt;
  f.setCustomers([{ id: 5, code: 'KH005', comments: 'ALOHA_WS:u1' }]);
  assert.equal((await f.run()).status, 'synced'); assert.equal(f.sent.length, 1);
});
test('blocked or regionless accounts never create customers', async () => {
  for (const patch of [{ active: false }, { siStatus: 'khoa' }, { siRegion: null }, { roles: ['customer'] }]) {
    const f = fixture(patch); assert.equal((await f.run()).status, 'busy_or_synced'); assert.equal(f.sent.length, 0);
  }
});
