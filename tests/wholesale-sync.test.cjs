const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsForTest = {};
const source = ts.transpileModule(fs.readFileSync('backend/shopOrders/wholesaleSync.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(source, { exports: exportsForTest, process, Date, Math, setInterval, clearInterval, require: name => {
  if (name === 'node:crypto') return require(name);
  if (name === './models.js') return { SHOP_ORDERS: 'orders' };
  if (name.includes('shopAuth/models')) return { SHOP_ACCOUNTS: 'accounts', shopAccountIdQuery: id => ({ _id: id }) };
  if (name === './orderRouteShared.js') return { fullAddressForKv: () => 'address' };
  if (name.includes('syncBus')) return { syncBus: { publish() {} } };
  return {};
} });
const { syncWholesaleOrder, wholesaleSyncBlock } = exportsForTest;
function matches(row, query) {
  return Object.entries(query).every(([k,v]) => {
    if (k === '$and') return v.every(q => matches(row,q));
    if (k === '$or') return v.some(q => matches(row,q));
    if (v === null) return row[k] == null;
    if (v && typeof v === 'object' && !(v instanceof Date)) return Object.entries(v).every(([op,arg]) => {
      if (op === '$in') return arg.includes(row[k]);
      if (op === '$exists') return (row[k] !== undefined) === arg;
      if (op === '$lte') return row[k] <= arg;
      throw Error(op);
    });
    return row[k] === v;
  });
}
function fixture(overrides = {}, accountOverrides = {}) {
  const row = { _id: 'o1', code: 'WEB-1', shopAccountId: 'u1', priceMode:'si', kvPushStatus:'queued',
    orderStatus:'cho_xac_nhan', revision:0, updatedAt:'v1', createdAt:new Date().toISOString(), policyAcceptedAt:'yes',
    orderDetails:[{productCode:'P1',quantity:1,price:1100,priceKind:'si'}], ...overrides };
  const account={ _id:'u1', siStatus:'active', roles:['si'], kvCustomerId:5, kvRetailer:'shop', siRegion:'HCM', phoneNorm:'0123', ...accountOverrides };
  function update(q,u) {
    if (!matches(row,q)) return {modifiedCount:0};
    Object.assign(row,u.$set||{});
    for(const k of Object.keys(u.$unset||{})) delete row[k];
    for(const [k,v] of Object.entries(u.$inc||{})) row[k]=(row[k]||0)+v;
    return {modifiedCount:1};
  }
  const db={collection:name=>name==='accounts'?{findOne:async()=>account}:{updateOne:async(q,u)=>update(q,u),findOneAndUpdate:async(q,u)=>update(q,u).modifiedCount?structuredClone(row):null}};
  let calls=0;
  const deps={lookup:async()=>({customers:[{id:5}],retailer:'shop'}),region:async()=> 'HCM',send:async input=>{calls++;assert.equal(input.totalPayment,0);assert.equal(input.orderDetails[0].price,1100);return {kvOrderId:99,kvOrderCode:'DH0099'};}};
  return {row,account,db,deps,calls:()=>calls};
}
test('concurrent workers create once and preserve immutable web code',async()=>{
  const f=fixture();await Promise.all(Array.from({length:20},()=>syncWholesaleOrder(f.db,{},'o1',f.deps)));
  assert.equal(f.calls(),1);assert.equal(f.row.code,'WEB-1');assert.equal(f.row.kvOrderCode,'DH0099');assert.equal(f.row.kvPushStatus,'synced');
});
test('lost response is unknown; repeated delivery never creates again',async()=>{
  const f=fixture();let calls=0;f.deps.send=async()=>{calls++;throw Error('timeout after commit');};
  await syncWholesaleOrder(f.db,{},'o1',f.deps);await syncWholesaleOrder(f.db,{},'o1',f.deps);
  assert.equal(calls,1);assert.equal(f.row.kvPushStatus,'unknown');
});
test('crash after POST claim requires reconciliation, not retry',async()=>{
  const f=fixture({kvPushStatus:'sending',kvSyncLeaseUntil:new Date(0)});
  await syncWholesaleOrder(f.db,{},'o1',f.deps);assert.equal(f.calls(),0);assert.equal(f.row.kvPushStatus,'unknown');
});
test('missing customer, revoked role, cancellation, expired hold and missing consent block send',async()=>{
  for (const [o,a,status] of [[{},{kvCustomerId:null},'awaiting_customer_link'],[{}, {siStatus:'khoa'},'account_review'],[{orderStatus:'huy'}, {},'cancelled'],[{holdExpiresAt:new Date(0)}, {},'needs_review'],[{policyAcceptedAt:null},{},'needs_review']]) {
    const f=fixture(o,a);await syncWholesaleOrder(f.db,{},'o1',f.deps);assert.equal(f.calls(),0);assert.equal(f.row.kvPushStatus,status);
  }
});
test('missing or non-si priceKind blocks send',async()=>{
  for (const details of [
    [{productCode:'P1',quantity:1,price:1100}],
    [{productCode:'P1',quantity:1,price:1100,priceKind:'web'}],
  ]) {
    const f=fixture({orderDetails:details});
    await syncWholesaleOrder(f.db,{},'o1',f.deps);
    assert.equal(f.calls(),0);
    assert.equal(f.row.kvPushStatus,'needs_review');
  }
});
test('duplicate phone matches and group mismatch need human review',async()=>{
  for(const duplicate of [true,false]){const f=fixture();if(duplicate)f.deps.lookup=async()=>({customers:[{id:5},{id:6}],retailer:'shop'});else f.deps.region=async()=>null;
    await syncWholesaleOrder(f.db,{},'o1',f.deps);assert.equal(f.calls(),0);assert.equal(f.row.kvPushStatus,'customer_review');}
});
test('remote lookup outage schedules bounded retry without POST',async()=>{
  const f=fixture();f.deps.lookup=async()=>{throw Error('offline');};await syncWholesaleOrder(f.db,{},'o1',f.deps);
  assert.equal(f.row.kvPushStatus,'retry_wait');assert.ok(f.row.kvSyncNextAt>Date.now());assert.equal(f.calls(),0);
});
test('order edited during lookup cannot be sent',async()=>{
  const f=fixture();f.deps.region=async()=>{f.row.revision++;return 'HCM';};await syncWholesaleOrder(f.db,{},'o1',f.deps);
  assert.equal(f.calls(),0);assert.equal(f.row.kvPushStatus,'needs_review');
});
test('numeric ID is not accepted as official order code',async()=>{
  const f=fixture();f.deps.send=async()=>({kvOrderId:99,kvOrderCode:'99'});await syncWholesaleOrder(f.db,{},'o1',f.deps);
  assert.equal(f.row.kvPushStatus,'unknown');assert.equal(f.row.kvOrderCode,undefined);
});
test('active mutation lease prevents worker claiming order',async()=>{
  const f=fixture({kvEditLeaseUntil:new Date(Date.now()+60000)});await syncWholesaleOrder(f.db,{},'o1',f.deps);assert.equal(f.calls(),0);
});
test('preparation crash can resume without duplicate side effects',async()=>{
  const f=fixture({kvPushStatus:'preparing',kvSyncLeaseUntil:new Date(0)});
  await syncWholesaleOrder(f.db,{},'o1',f.deps);assert.equal(f.calls(),1);assert.equal(f.row.kvPushStatus,'synced');
});
test('changed customer link during validation prevents dispatch',async()=>{
  const f=fixture();f.deps.region=async()=>{f.account.updatedAt='changed';return 'HCM';};
  // Return account snapshots, as MongoDB does.
  const oldCollection=f.db.collection;f.db.collection=n=>n==='accounts'?{findOne:async()=>structuredClone(f.account)}:oldCollection(n);
  await syncWholesaleOrder(f.db,{},'o1',f.deps);assert.equal(f.calls(),0);assert.equal(f.row.kvPushStatus,'customer_review');
});
test('failure to persist successful remote result becomes unknown',async()=>{
  const f=fixture();const oldCollection=f.db.collection;f.db.collection=n=>{
    const col=oldCollection(n);if(n!=='orders')return col;
    return {...col,updateOne:async(q,u)=>{if(u.$set?.kvPushStatus==='synced')throw Error('database outage');return col.updateOne(q,u);}};
  };
  await syncWholesaleOrder(f.db,{},'o1',f.deps);await syncWholesaleOrder(f.db,{},'o1',f.deps);
  assert.equal(f.calls(),1);assert.equal(f.row.kvPushStatus,'unknown');
});
test('repeated customer lookup failures stop after bounded preparation attempts',async()=>{
  const f=fixture({kvSyncPrepareAttempts:4});f.deps.lookup=async()=>{throw Error('offline');};
  await syncWholesaleOrder(f.db,{},'o1',f.deps);assert.equal(f.calls(),0);assert.equal(f.row.kvPushStatus,'needs_review');
});

function adminFixture({order,kv}) {
  const routes={};const ex={};let writes=0;
  const orders={findOne:async()=>order,updateOne:async()=>{writes++;return {modifiedCount:1};}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('backend/shopOrders/wholesaleSyncAdmin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports:ex,process,Date,AbortSignal,fetch:async()=>({ok:true,json:async()=>kv}),require:n=>{
      if(n==='node:crypto')return require(n);
      if(n.includes('auth/middleware'))return {requireAuth:()=>()=>{},requireActive(){},requireManager(){}};
      if(n.includes('shopAuth/models'))return {SHOP_ACCOUNTS:'accounts',shopAccountIdQuery:id=>({_id:id})};
      if(n==='./models.js')return {SHOP_ORDERS:'orders'};
      if(n==='./findShopOrder.js')return {shopOrderLookupFilter:code=>({code})};
      if(n.includes('kvApiClient'))return {loadKvCreds:async()=>({retailer:'shop'}),fetchKvAccessToken:async()=> 'test',kvApiBase:()=> 'https://example.invalid'};
      return {};
    },
  });
  const app={get(){},post:(p,...handlers)=>routes[p]=handlers.at(-1)};
  ex.registerWholesaleSyncAdmin(app,async()=>({collection:()=>orders}),async()=>({}));
  return {async reconcile(){let status=200;const res={status(s){status=s;return this;},json(body){this.body=body;return this;}};await routes['/api/shop/admin/si-sync/:code/reconcile']({params:{code:'WEB-1'},body:{kvOrderId:99},auth:{userId:'manager'}},res);return {status,body:res.body};},writes:()=>writes};
}
test('reconciliation rejects wrong marker, customer and missing official code',async()=>{
  for(const change of [{description:'unrelated'},{customerId:999},{code:''}]){
    const f=adminFixture({order:{_id:'o1',code:'WEB-1',priceMode:'si',kvPushStatus:'unknown',kvSyncRetailer:'shop',kvSyncCustomerId:5},kv:{id:99,code:'DH0099',customerId:5,description:'ALOHA:o1 | Web WEB-1',...change}});
    assert.equal((await f.reconcile()).status,409);assert.equal(f.writes(),0);
  }
});
test('reconciliation accepts exact remote marker and customer without POST',async()=>{
  const f=adminFixture({order:{_id:'o1',code:'WEB-1',priceMode:'si',kvPushStatus:'unknown',kvSyncRetailer:'shop',kvSyncCustomerId:5},kv:{id:99,code:'DH0099',customerId:5,description:'ALOHA:o1 | Web WEB-1'}});
  assert.equal((await f.reconcile()).status,200);assert.equal(f.writes(),1);
});
