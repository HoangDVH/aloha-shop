/**
 * Lock shop frontend to standalone; disable monorepo shop ecosystem name clash.
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

echo "=== 1) Disable monorepo shop ecosystem name=aloha-shop ==="
MONO=/root/aloha_thumua_webapp/shop/ecosystem.config.cjs
if [ -f "\$MONO" ]; then
  cp -a "\$MONO" "/root/aloha_thumua_webapp/shop/ecosystem.config.cjs.bak.\$(date +%Y%m%d%H%M%S)"
  cat > "\$MONO" <<'EOF'
/**
 * DISABLED — production shop frontend is /root/aloha-shop/frontend
 * Do NOT pm2 start this file (name clash with aloha-shop).
 */
module.exports = {
  apps: [
    {
      name: "aloha-shop-MONOREPO-DISABLED",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3999",
      autorestart: false,
      max_restarts: 0,
      env: {
        NODE_ENV: "production",
        PORT: "3999",
        NEXT_PUBLIC_SHOP_ORIGIN: "https://alohathegioichaucay.com",
        SHOP_API_INTERNAL: "http://127.0.0.1:3001",
      },
    },
  ],
};
EOF
  echo "rewrote monorepo ecosystem"
fi

echo "=== 2) Ensure standalone shop running ==="
pm2 delete aloha-shop >/dev/null 2>&1 || true
pm2 delete aloha-shop-MONOREPO-DISABLED >/dev/null 2>&1 || true
cd /root/aloha-shop/frontend
pm2 start ecosystem.config.cjs
pm2 save

echo "=== 3) Cleanup orphan top-level theme on appearance (SEO fix leftover) ==="
mongosh --quiet aloha_shop_db --eval '
const d=db.aloha_shop_appearance.findOne({_id:"storefront"});
print("hasTopTheme="+!!(d && d.theme));
if (d && d.theme) {
  db.aloha_shop_appearance.updateOne({_id:"storefront"}, { \$unset: { theme: "" } });
  print("unset top-level theme");
}
const after=db.aloha_shop_appearance.findOne({_id:"storefront"},{theme:1,published:1,draft:1,publishedAt:1});
print("keys="+Object.keys(after).join(","));
print("pubVer="+after.published.version+" draftVer="+after.draft.version);
print("pubTitles="+after.published.blocks.map(b=>((b.enabled===false)?"[off]":"[on]")+((b.props&&b.props.title)||b.type)).join(" | "));
print("heroSlides="+((after.published.blocks.find(b=>b.type==="hero")||{}).props||{}).useDefaultBanners);
const slides=((after.published.blocks.find(b=>b.type==="hero")||{}).props||{}).slides||[];
print("customSlides="+slides.length);
print("seoTpl="+(after.published.theme.seo&&after.published.theme.seo.productTitleTemplate||"").slice(0,60));
'

echo "=== 4) Verify processes ==="
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{for(const p of JSON.parse(d||"[]")){if(/aloha-shop|aloha-app/.test(p.name)) console.log(p.name,p.pm2_env.status,"cwd="+(p.pm2_env.pm_cwd||""))}})'

sleep 3
echo "=== 5) Homepage titles from HTML (enabled sections only) ==="
curl -sS -m 20 "http://127.0.0.1:3002/?t=\$(date +%s)" | node -e '
let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{
  for (const c of ["Sản phẩm bán chạy","Cây thành phẩm","BÌNH CẤM HOA","Bài viết","Bài viết mới"]) console.log(c+"="+d.includes(c));
});'

echo "=== LOCK_OK ==="
`;

const conn = new Client();
conn
  .on("ready", () => {
    console.log("SSH OK");
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
