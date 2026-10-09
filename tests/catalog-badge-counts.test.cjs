const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('frontend/components/catalog/useCatalogBadgeCounts.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture(fetcher=async opts=>({total:opts.badge==='moi'?3:0})){
 const exports={}, requests=[], timers=[]; let state=null,lastDeps,cleanup;
 vm.runInNewContext(code,{exports,AbortController,window:{setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{}},require(name){
  if(name==='react')return {useState:()=>[state,v=>state=v],useEffect:(fn,deps)=>{const key=JSON.stringify(deps);if(key!==lastDeps){cleanup?.();lastDeps=key;cleanup=fn();}}};
  if(name==='@/lib/api')return {fetchProducts:opts=>{requests.push(opts);return fetcher(opts);}};
  throw Error(name);
 }});
 return {render:(scope,enabled=true)=>exports.useCatalogBadgeCounts(scope,enabled), requests, run:()=>timers.shift()(), get state(){return state;}};
}
test('counts preserve category, price and attributes and ignore the active badge',async()=>{
 const f=fixture(), scope={categoryId:[11,12],minPrice:100,attr:['Size:S'],badge:'moi',sort:'price_desc',gift:'gia-dinh'};
 assert.deepEqual(Object.keys(f.render(scope)),[]);
 await f.run();
 assert.equal(f.requests.length,4);
 for(const request of f.requests){
  assert.deepEqual(Array.from(request.categoryId),[11,12]);assert.equal(request.minPrice,100);
  assert.equal(request.gift,'gia-dinh');assert.equal(request.sort,'ten');assert.equal(request.limit,1);
 }
 assert.equal(f.render(scope).moi,3);assert.equal(f.render(scope).noi_bat,0);
});
test('late results from an abandoned scope cannot overwrite newer counts',async()=>{
 const resolve=[];
 const f=fixture(opts=>new Promise(r=>resolve.push(r)));
 f.render({categoryId:[1]});const old=f.run();
 f.render({categoryId:[2]});
 assert.equal(f.requests[0].signal.aborted,true);
 resolve.forEach(r=>r({total:99}));await old;
 assert.equal(f.state,null);
});
test('failed count requests remain unknown instead of disabling the badge',async()=>{
 const f=fixture(async opts=>{if(opts.badge==='moi')throw Error('offline');return {total:2};});
 f.render({});await f.run();assert.equal(f.render({}).moi,undefined);assert.equal(f.render({}).noi_bat,2);
});
