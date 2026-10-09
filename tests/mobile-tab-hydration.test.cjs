const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const jsx=(type,props)=>({type,props:props||{}});
const code=ts.transpileModule(fs.readFileSync('frontend/components/ShopMobileTabBar.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(mounted,on){
 const exports={};
 vm.runInNewContext(code,{exports,require(name){
  if(name==='react')return {useState:()=>[mounted,()=>{}],useEffect:()=>{}};
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
  if(name==='next/navigation')return {usePathname:()=>'/tim'};
  if(name==='next/link')return {default:'link'};
  if(name==='lucide-react')return {};
  if(name==='@/lib/cart')return {useCart:()=>0};
  if(name==='@/lib/campaign/navAccent')return {useDealsNavAccent:()=>({on})};
  throw Error(name);
 }});
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props.children)]:[];
 return nodes(exports.ShopMobileTabBar()).find(n=>n.props.href==='/uu-dai');
}
test('initial voucher tab matches SSR even when campaign data is cached in the browser',()=>{
 const server=render(false,false),client=render(false,true);
 assert.equal(server.props['aria-label'],client.props['aria-label']);
 assert.equal(client.props.style,undefined);
});
test('campaign accent becomes visible after mount',()=>{
 assert.ok(render(true,true).props.style.color);
});
