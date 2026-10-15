const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const jsx=(type,props)=>typeof type==='function'?type(props||{}):({type,props});
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require(name){if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(name==='next/link')return{default:p=>jsx('a',p)};if(name==='lucide-react')return{Check:()=>null,TicketPercent:()=>null};if(name in imports)return imports[name];throw Error(name);}});return exports;}
const format=load('frontend/lib/voucherFormat.ts');
const {ProductScopedVoucherCard}=load('frontend/components/voucher/ProductScopedVoucherCard.tsx',{'@/lib/voucherFormat':format});
const voucher={id:'OCT20',title:'Ưu đãi 20/10',discountType:'percentage',discountValue:10,maxDiscountVnd:200000,scope:'product',productMas:['CBGCMM','GSDL','SDGN']};
function nodes(n){return !n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(8).flatMap(nodes)];}
test('scoped card separates saving from browsing correct products',()=>{
  let claims=0;
  const tree=ProductScopedVoucherCard({voucher,state:'claimable',onClaim:()=>claims++});
  assert.match(JSON.stringify(tree),/Chỉ áp dụng 3 sản phẩm/);
  const all=nodes(tree),link=all.find(n=>n.type==='a'),button=all.find(n=>n.type==='button');
  assert.equal(link.props.href,'/tim?voucher=OCT20');
  assert.equal(link.props.children,'Sản phẩm áp dụng ›');
  assert.equal(button.props.children,'Lưu mã');button.props.onClick();assert.equal(claims,1);
});

test('compact cards never fill the list height and keep scope details on the product link',()=>{
  for(const popup of [true,false]){
    const tree=ProductScopedVoucherCard({voucher,state:'auto',onClaim(){},popup});
    assert(!tree.props.className.split(/\s+/).includes('h-full'));
    assert(tree.props.className.includes('shrink-0'));
    const all=nodes(tree);
    const link=all.find(n=>n.type==='a');
    assert.match(link.props['aria-label'],/Chỉ áp dụng 3 sản phẩm/);
    assert(!all.some(n=>n.props?.children==='Áp dụng khi đủ điều kiện'));
    assert(!all.some(n=>n.props?.children==='Chỉ áp dụng 3 sản phẩm'));
  }
});
test('saved and blocked states never advertise another save or universal application',()=>{
  for(const state of ['claimed','locked','soldOut','upcoming','auto']){
    const tree=ProductScopedVoucherCard({voucher,state,onClaim:()=>{throw Error('Not claimable');}});
    assert(!nodes(tree).some(n=>n.type==='button'));
    assert(nodes(tree).some(n=>n.type==='a'));
    assert(!JSON.stringify(tree).includes('Tự động áp dụng'));
  }
});
test('scope counts distinct eligible codes and campaign ordering promotes the product voucher',()=>{
  assert.equal(format.voucherScopeHint({scope:'product',productMas:[' a ','A','B'],excludedProductMas:['b']}),'Chỉ áp dụng 1 sản phẩm');
  const list=[{id:'NEW'},{id:'OCT20',scope:'product'},{id:'SHIP'}];
  assert.equal(format.productVouchersFirst(list)[0].id,'OCT20');
  assert.equal(list[0].id,'NEW');
});
