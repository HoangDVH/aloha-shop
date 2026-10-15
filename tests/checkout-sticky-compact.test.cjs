const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({type, props:props || {}});
const code = ts.transpileModule(fs.readFileSync('frontend/components/checkout/CheckoutStickyBar.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(extra={}, open=false, retained=null) {
 const exports={}, calls=[]; let state=0;
 vm.runInNewContext(code,{exports,document:{},require(name){
  if(name==='react/jsx-runtime') return {jsx,jsxs:jsx};
  if(name==='react') return {useEffect:()=>{},useId:()=> 'detail',useState:()=> [state++===0 ? open : true,()=>{}]};
  if(name==='react-dom') return {createPortal:node=>node};
  if(name==='@/lib/floatingStack') return {useStickyBarHeight:()=>null};
  if(name==='@/lib/api') return {formatVnd:v=>String(v)};
  if(name==='@/lib/usePendingValue') return {usePendingValue:(value,pending)=>pending?retained:value};
  if(name==='./PriceUpdateIndicator') return {PriceUpdateIndicator:'price-update'};
  throw Error(name);
 }});
 const tree=exports.CheckoutStickyBar({total:100,discount:10,grandTotal:115,shippingFee:25,canSubmit:true,submitting:false,onPlaceOrder:()=>calls.push('place'),showShipping:true,...extra});
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props.children)]:[];
 return {nodes:nodes(tree),calls};
}
test('default bar shows total and place order while detailed breakdown is collapsed',()=>{
 const f=render(); assert.equal(f.nodes.some(n=>n.props.id==='detail'),false);
 const buttons=f.nodes.filter(n=>n.type==='button'); assert.equal(buttons.length,2);
 assert.equal(buttons[0].props['aria-expanded'],false);
 buttons[1].props.onClick(); assert.deepEqual(f.calls,['place']);
 assert.ok(f.nodes.some(n=>n.props.children==='115'));
});
test('unknown shipping and store pickup use the subtotal after discounts',()=>{
 for(const extra of [{shippingFee:null},{deliveryMethod:'nhan_cua_hang'}]) {
  assert.ok(render(extra).nodes.some(n=>n.props.children==='90'));
 }
});
test('expanded breakdown is scrollable and submitting prevents another order',()=>{
 const f=render({submitting:true},true);
 assert.match(f.nodes.find(n=>n.props.id==='detail').props.className,/max-h.*overflow-y-auto/);
 assert.equal(f.nodes.filter(n=>n.type==='button')[1].props.disabled,true);
});

test('repricing keeps the previous mobile total and suppresses transient missing-information warnings',()=>{
 const retained={total:100,discount:10,volumeDiscount:0,flashDiscount:0,productDiscount:0,
  grandTotal:115,shippingFee:25,shippingDiscount:0,canSubmit:true,orderBlockedReason:''};
 const f=render({total:999,grandTotal:999,shippingFee:null,totalPending:true,canSubmit:false,
  orderBlockedReason:'Updating prices'},true,retained);
 assert.ok(f.nodes.some(n=>n.props.children==='115'));
 assert.ok(!f.nodes.some(n=>n.props.children==='999'));
 assert.ok(!f.nodes.some(n=>n.props.children==='Updating prices'));
 const action=f.nodes.filter(n=>n.type==='button')[1];
 assert.equal(action.props.disabled,true);
 assert.ok(f.nodes.some(n=>n.type==='price-update' && n.props.pending===true));
});
