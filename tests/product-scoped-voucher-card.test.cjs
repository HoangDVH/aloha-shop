const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const jsx=(type,props)=>typeof type==='function'?type(props||{}):({type,props});
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require(name){if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(name==='next/link')return{default:p=>jsx('a',p)};if(name==='lucide-react')return{Check:()=>null,TicketPercent:()=>null};if(name in imports)return imports[name];throw Error(name);}});return exports;}
const format=load('frontend/lib/voucherFormat.ts');
const imports={'@/lib/voucherFormat':format,'@/lib/api':{formatVnd:n=>n.toLocaleString('vi-VN')+'đ'}};
const {ProductScopedVoucherCard,CompactVoucherCard}=load('frontend/components/voucher/ProductScopedVoucherCard.tsx',imports);
const voucher={id:'OCT20',title:'Ưu đãi 20/10',discountType:'percentage',discountValue:10,maxDiscountVnd:200000,scope:'product',productMas:['CBGCMM','GSDL','SDGN']};
function nodes(n){return !n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(8).flatMap(nodes)];}
test('scoped card separates saving from browsing correct products',()=>{
  let claims=0;
  const tree=ProductScopedVoucherCard({voucher,state:'claimable',onClaim:()=>claims++});
  assert(!JSON.stringify(tree).includes('3 sản phẩm'));
  const all=nodes(tree),link=all.find(n=>n.type==='a'),button=all.find(n=>n.type==='button');
  assert.equal(link.props.href,'/tim?voucher=OCT20');
  assert.equal(link.props.children,'Sản phẩm áp dụng ›');
  assert.equal(button.props.children,'Nhận');button.props.onClick();assert.equal(claims,1);
});

test('compact cards never fill the list height and keep scope details on the product link',()=>{
  for(const popup of [true,false]){
    const tree=ProductScopedVoucherCard({voucher,state:'auto',onClaim(){},popup});
    assert(!tree.props.className.split(/\s+/).includes('h-full'));
    assert(tree.props.className.includes('shrink-0'));
    const all=nodes(tree);
    const link=all.find(n=>n.type==='a');
    assert.match(link.props['aria-label'],/sản phẩm áp dụng/i);
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
test('scope is explicit without product counts and campaign ordering promotes the product voucher',()=>{
  assert.equal(format.voucherScopeHint({scope:'product',productMas:[' a ','A','B'],excludedProductMas:['b']}),'Chỉ áp dụng sản phẩm được chọn');
  const list=[{id:'NEW'},{id:'OCT20',scope:'product'},{id:'SHIP'}];
  assert.equal(format.productVouchersFirst(list)[0].id,'OCT20');
  assert.equal(list[0].id,'NEW');
});

test('old voucher titles omit the product-count annotation without changing eligibility data',()=>{
  const original={...voucher,title:'Giảm 10% đặt trước 20/10 (3 sản phẩm)'};
  for(const popup of [true,false]){
    const tree=ProductScopedVoucherCard({voucher:original,state:'auto',onClaim(){},popup});
    assert(!JSON.stringify(tree).includes('3 sản phẩm'));
  }
  assert.equal(format.voucherCustomerTitle(original.title),'Giảm 10% đặt trước 20/10');
  assert.equal(original.productMas.length,3);
});

test('strip omits goods thresholds but shows full shipping amounts and qualifying order values',()=>{
  const october={...voucher,title:'Giảm 10% đặt trước 20/10 (3 sản phẩm)'};
  const cases=[october,{...voucher,scope:'all',targetCustomer:'new_web'},
    {...voucher,scope:'all',benefitType:'shipping',discountType:'fixed',discountValue:30000,minOrderThreshold:1000000},
    {...voucher,scope:'all',benefitType:'shipping',discountType:'fixed',discountValue:50000,minOrderThreshold:2000000}];
  for(const v of cases){
    const tree=CompactVoucherCard({voucher:v,state:'auto',onClaim(){}});
    const text=JSON.stringify(tree);
    if(v.benefitType==='shipping'){
      assert.equal(tree.props.title,`Hỗ trợ phí ship ${v.discountValue.toLocaleString('vi-VN')}đ`);
      assert(text.includes(v.minOrderThreshold.toLocaleString('vi-VN')+'đ'));
      assert(text.includes('Đơn từ'));
    }else assert(!/tối đa|tối thiểu|đơn từ|đơn 1tr/i.test(text));
    if(v===october) assert.equal(tree.props.title,'Giảm 10% đặt trước 20/10');
  }
  assert.equal(october.maxDiscountVnd,200000);
  assert.equal(cases[2].minOrderThreshold,1000000);
});

test('goods voucher formatters and popup hide thresholds while shipping retains its condition',()=>{
  const goods={...voucher,benefitType:'goods',minOrderThreshold:500000};
  assert.equal(format.voucherConditionText(goods),'');
  assert(!/tối đa|đơn/i.test(format.formatVoucherBadge(goods).label));
  const popup=ProductScopedVoucherCard({voucher:goods,state:'auto',popup:true,onClaim(){}});
  assert(!/Tối đa|Đơn từ/.test(JSON.stringify(popup)));
  const ship={...goods,benefitType:'shipping',discountType:'fixed',discountValue:30000,minOrderThreshold:1000000};
  assert.match(format.voucherConditionText(ship),/Đơn từ 1TR/);
  assert.equal(goods.maxDiscountVnd,200000);
  assert.equal(goods.minOrderThreshold,500000);
});
