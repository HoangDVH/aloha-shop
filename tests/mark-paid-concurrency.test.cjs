const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');

const compiled = ts.transpileModule(fs.readFileSync('backend/shopOrders/markPaid.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture(options = {}) {
  let doc = { _id: 'order-id', code: 'WEB-RACE', paymentStatus: 'unpaid', total: 100000, totalPayment: 100000,
    kvInvoiceId: '123', kvInvoiceCode: 'HD123', kvInvoiceMode: 'awaiting',
    orderDetails: [{ productCode: 'POT', quantity: 2, price: 50000 }], ...options.order };
  const counts = { invoices: 0, stock: 0, holds: 0, redemptions: 0, firstPurchase: 0 };
  let readers = 0, releaseReaders;
  const readerGate = new Promise(resolve => { releaseReaders = resolve; });
  const clone = value => structuredClone(value);
  function matches(filter) {
    return Object.entries(filter).every(([k,v]) => {
      if(k === '$or') return v.some(matches);
      if(v && typeof v==='object' && '$in' in v) return v.$in.includes(doc[k]);
      if(v && typeof v==='object' && '$exists' in v) return (doc[k]!==undefined)===v.$exists;
      if(v && typeof v==='object' && '$gt' in v) return doc[k]>v.$gt;
      return v===null ? doc[k]==null : doc[k]===v;
    });
  }
  function apply(update) {
    Object.assign(doc, clone(update.$set||{}));
    for(const key of Object.keys(update.$unset||{}))delete doc[key];
  }
  const col = {
    async findOne(filter) {
      if(filter.sepayTransactionId!=null)return doc.sepayTransactionId===filter.sepayTransactionId?clone(doc):null;
      const result = clone(doc);
      if(filter.$or && options.concurrentReaders){readers++;if(readers===options.concurrentReaders)releaseReaders();await readerGate;}
      return result;
    },
    async findOneAndUpdate(filter, update) {
      if(options.claimMiss){doc.paymentStatus='processing';return options.wrapped?{value:null}:null;}
      const result=matches(filter)?(apply(update),clone(doc)):null;
      return options.wrapped?{value:result}:result;
    },
    async updateOne(filter, update) {
      if(!matches(filter))return {matchedCount:0,modifiedCount:0};
      apply(update);return {matchedCount:1,modifiedCount:1};
    },
  };
  const db={collection:()=>col}, exports={};
  vm.runInNewContext(compiled, {exports,Date,require(name){
    if(name==='node:crypto')return {randomUUID};
    if(name.endsWith('/kvDeliveryAddress.js'))return {kvDeliveryAddressForOrder:()=>({})};
    if(name.endsWith('/syncBus.js'))return {syncBus:{publish(){}}};
    if(name.endsWith('/models.js'))return {SHOP_ORDERS:'orders'};
    if(name.endsWith('/invoiceService.js'))return {async ensurePaidInvoice(){
      counts.invoices++;await new Promise(resolve=>setImmediate(resolve));
      if(options.loseOwnership)doc.paymentClaimId='different-owner';
      if(options.invoiceFailure)throw Error('Invoice rejected');
      return {kvInvoiceId:'123',kvInvoiceCode:'HD123'};
    }};
    if(name.endsWith('/stockApply.js'))return {async applyShopOrderStockDeduct(){counts.stock++;if(options.stockCrash)throw Error('Stock write interrupted');return {updated:['POT'],shortfall:[]};}};
    if(name.endsWith('/stockHold.js'))return {async consumeShopStockHolds(){counts.holds++;}};
    if(name.endsWith('/redemptionService.js'))return {async markRedemptionUsed(){counts.redemptions++;}};
    if(name.endsWith('/claimService.js'))return {async recordFirstPurchaseConsumedForRegularOrder(){counts.firstPurchase++;}};
    throw Error(name);
  }});
  return {counts,get order(){return clone(doc);},run(source='admin',extra={}){return exports.markShopOrderPaid({shopDb:db,mainDb:db,orderCode:'WEB-RACE',source,
    ...(source==='kiotqr'?{kvPaymentProof:{invoiceId:'123',invoiceCode:'HD123',expected:100000,received:100000}}:{}),...extra});}};
}

test('admin, SePay and KiotQR racing on unpaid run invoice and stock side effects only once',async()=>{
  const f=fixture({concurrentReaders:3});
  const results=await Promise.all([f.run('admin'),f.run('sepay',{sepayTransactionId:'TX1'}),f.run('kiotqr')]);
  assert.equal(results.filter(r=>r.ok&&!r.alreadyPaid).length,1);
  assert.equal(results.filter(r=>!r.ok&&r.code==='payment_processing').length,2);
  assert.equal(f.counts.invoices,1);
  assert.equal(f.counts.stock,1);
  assert.equal(f.counts.holds,1);
  assert.equal(f.counts.redemptions,1);
  assert.equal(f.counts.firstPurchase,1);
  assert.equal(f.order.paymentStatus,'paid');
  assert.equal(f.order.stockApplied,true);
});

test('processing, including an old processing claim, never authorizes another caller',async()=>{
  for(const source of ['admin','sepay','kiotqr']){
    const f=fixture({order:{paymentStatus:'processing',paymentClaimedAt:'2020-01-01T00:00:00Z',paymentClaimId:'owner'}});
    const r=await f.run(source,{sepayTransactionId:'LATE-TX'});
    assert.equal(r.ok,false);assert.equal(r.code,'payment_processing');
    assert.equal(f.counts.invoices,0);assert.equal(f.counts.stock,0);
    assert.equal(f.order.sepayTransactionId,undefined);
  }
});

test('an order without a KiotViet invoice permits only one creation attempt across concurrent sources',async()=>{
  const f=fixture({concurrentReaders:2,order:{kvInvoiceId:null,kvInvoiceCode:null,kvInvoiceMode:null}});
  const results=await Promise.all([f.run('admin'),f.run('sepay',{sepayTransactionId:'TX-CREATE'})]);
  assert.equal(results.filter(r=>r.ok).length,1);
  assert.equal(f.counts.invoices,1);assert.equal(f.counts.stock,1);
  assert.equal(f.order.kvInvoiceCode,'HD123');assert.equal(f.order.paymentStatus,'paid');
});

test('invoice failure is recorded by its owner and a later failed-status retry acquires a fresh claim',async()=>{
  const options={invoiceFailure:true};const f=fixture(options);
  const failed=await f.run();assert.equal(failed.ok,false);assert.equal(failed.code,'kv_invoice_failed');
  assert.equal(f.order.paymentStatus,'failed');assert.equal(f.counts.stock,0);
  const previous=f.order.paymentClaimId;assert(previous);
  options.invoiceFailure=false;
  assert.equal((await f.run()).ok,true);assert.notEqual(f.order.paymentClaimId,previous);
  assert.equal(f.counts.stock,1);
});

test('CAS loser handles both direct null and legacy value:null without side effects',async()=>{
  for(const wrapped of [false,true]){
    const f=fixture({claimMiss:true,wrapped});const r=await f.run();
    assert.equal(r.ok,false);assert.equal(r.code,'payment_processing');
    assert.equal(f.counts.invoices,0);assert.equal(f.counts.stock,0);
  }
});

test('paid callbacks stay idempotent and a stored stockApplied flag skips another deduction',async()=>{
  const paid=fixture({order:{paymentStatus:'paid',stockApplied:true}});
  assert.equal((await paid.run()).alreadyPaid,true);assert.equal(paid.counts.invoices,0);assert.equal(paid.counts.stock,0);
  const retry=fixture({order:{paymentStatus:'failed',stockApplied:true}});
  assert.equal((await retry.run()).ok,true);assert.equal(retry.counts.stock,0);
});

test('a lost claim cannot persist invoice results or reach stock deduction',async()=>{
  const f=fixture({loseOwnership:true});const r=await f.run();
  assert.equal(r.ok,false);assert.equal(r.code,'payment_claim_lost');assert.equal(f.counts.stock,0);
  assert.equal(f.order.paymentStatus,'processing');
});

test('interruption after invoice persistence stays processing and is not blindly replayed',async()=>{
  const f=fixture({stockCrash:true});await assert.rejects(f.run(),/Stock write interrupted/);
  const r=await f.run();assert.equal(r.ok,false);assert.equal(r.code,'payment_processing');
  assert.equal(f.counts.invoices,1);assert.equal(f.counts.stock,1);
});
