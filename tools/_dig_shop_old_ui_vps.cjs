/**
 * Dig why shop UI looks old — process cwd, nginx, appearance history, public vs API.
 */
const path = require("path");
const { createRequire } = require("module");
function loadSsh2() {
  try {
    return createRequire(path.join(__dirname, "..", "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}
const { Client } = loadSsh2();
const password = process.env.VPS_PASSWORD || "aloha2026@";

const remoteCmd = `
set -e
echo "=== pm2 detailed ==="
pm2 prettylist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const arr=eval(d); for (const p of arr){ if(!/aloha-shop|aloha-app/.test(p.name)) continue; const e=p.pm2_env||{}; console.log("---",p.name); console.log("status",e.status,"cwd",e.pm_cwd); console.log("script",e.pm_exec_path); console.log("env SHOP_API_INTERNAL", (e.env||{}).SHOP_API_INTERNAL||(e.env||{}).NEXT_PUBLIC_API_BASE||""); console.log("args",e.args);}})' 2>/dev/null || pm2 show aloha-shop | sed -n "1,80p"

echo "=== ecosystem locations ==="
ls -la /root/aloha-shop/frontend/ecosystem.config.cjs /root/aloha-shop/ecosystem.config.cjs /root/aloha_thumua_webapp/shop/ecosystem.config.cjs 2>/dev/null || true
for f in /root/aloha-shop/frontend/ecosystem.config.cjs /root/aloha-shop/ecosystem.config.cjs /root/aloha_thumua_webapp/shop/ecosystem.config.cjs; do
  if [ -f "\$f" ]; then echo "FILE \$f"; sed -n "1,80p" "\$f"; echo "----"; fi
done

echo "=== nginx shop upstream ==="
grep -RIn "3002\\|aloha-shop\\|proxy_pass\\|alohathegioichaucay" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | head -60

echo "=== appearance history / previous ==="
mongosh --quiet aloha_shop_db --eval '
const d=db.aloha_shop_appearance.findOne({_id:"storefront"});
print("publishedAt="+d.publishedAt);
print("version pub="+ (d.published&&d.published.version) +" draft="+ (d.draft&&d.draft.version));
print("pubTitles="+(d.published.blocks||[]).map(b=>(b.props&&b.props.title)||b.type).join(" | "));
print("prevTitles="+((d.publishedPrevious&&d.publishedPrevious.blocks)||[]).map(b=>(b.props&&b.props.title)||b.type).join(" | "));
print("historyLen="+(d.history||[]).length);
(d.history||[]).slice(0,8).forEach(h=>{
  const titles=((h.snapshot&&h.snapshot.blocks)||[]).map(b=>(b.props&&b.props.title)||b.type).join(" | ");
  print("H "+h.at+" by="+h.by+" note="+h.note+" ver="+(h.snapshot&&h.snapshot.version)+" :: "+titles);
});
print("topThemeKeys="+Object.keys(d.theme||{}).join(","));
print("topThemeSeo="+JSON.stringify(d.theme&&d.theme.seo&&{t:d.theme.seo.productTitleTemplate,site:d.theme.siteName}));
'

echo "=== public domain appearance ==="
curl -sS -m 20 -H "Cache-Control: no-cache" "https://alohathegioichaucay.com/api/shop/appearance" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d); console.log(JSON.stringify({version:j.version,publishedAt:j.publishedAt,titles:(j.blocks||[]).map(b=>(b.props&&b.props.title)||b.type)},null,2));});'

echo "=== homepage via domain sniff blocks ==="
curl -sS -m 25 -H "Cache-Control: no-cache" "https://alohathegioichaucay.com/" | node -e '
let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{
  const checks=["Sản phẩm bán chạy","Cây thành phẩm","BÌNH CẤM HOA","Bài viết","Combo Đế Vương","why_aloha","Khuyến mãi"];
  const out={};
  for (const c of checks) out[c]=d.includes(c);
  console.log(JSON.stringify(out,null,2));
});'

echo "=== compare builds ==="
ls -la /root/aloha-shop/frontend/.next/BUILD_ID /root/aloha_thumua_webapp/shop/.next/BUILD_ID 2>/dev/null || true
echo shop_standalone_BUILD=\$(cat /root/aloha-shop/frontend/.next/BUILD_ID 2>/dev/null || echo missing)
echo monorepo_shop_BUILD=\$(cat /root/aloha_thumua_webapp/shop/.next/BUILD_ID 2>/dev/null || echo missing)

echo "=== DIG_DONE ==="
`;

const conn = new Client();
conn
  .on("ready", () => {
    conn.exec(remoteCmd, { pty: true }, (e, stream) => {
      if (e) {
        console.error(e);
        conn.end();
        process.exit(1);
      }
      stream.on("data", (d) => process.stdout.write(d.toString()));
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      stream.on("close", (c) => {
        conn.end();
        process.exit(c || 0);
      });
    });
  })
  .on("error", (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({ host: "160.25.167.211", port: 22, username: "root", password, readyTimeout: 60000 });
