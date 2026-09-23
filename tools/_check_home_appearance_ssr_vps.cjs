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
# Fetch homepage and search for binh/cam/hoa encodings
curl -sS -m 20 http://127.0.0.1:3002/ -o /tmp/home2.html
node -e '
const fs=require("fs");
const d=fs.readFileSync("/tmp/home2.html","utf8");
const needles=["BÌNH CẤM HOA","BINH CAM HOA","B\\\\u00ccNH","product_section","Cây thành phẩm","fallback","version", "\"version\":83", "83"];
for (const n of needles) {
  console.log(n, d.includes(n) || d.toLowerCase().includes(n.toLowerCase()));
}
// find nearby titles
const m=[...d.matchAll(/Sản phẩm bán chạy|Cây thành phẩm|Bài viết|BÌNH|CAM HOA|product_section/gi)];
console.log("matches", m.slice(0,30).map(x=>x[0]));
console.log("len", d.length);
// extract __NEXT_DATA__ or RSC hints
const idx=d.indexOf("B");
'

echo "=== SSR fetch appearance from shop process env ==="
pm2 show aloha-shop | sed -n "/cwd\\|script\\|SHOP_API\\|NODE_ENV\\|status/p" | head -40

# simulate internal appearance fetch
curl -sS -m 10 http://127.0.0.1:3001/api/shop/appearance | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d); console.log(j.blocks.map(b=>({type:b.type,enabled:b.enabled,title:b.props&&b.props.title})));});'

# check if next is reading wrong API - look at built server chunk for shopApiBase / fallback
grep -R "Cây thành phẩm" /root/aloha-shop/frontend/.next/server -l 2>/dev/null | head -5
grep -R "BÌNH CẤM HOA" /root/aloha-shop/frontend/.next/server -l 2>/dev/null | head -5 || echo "no hardcoded BINH in build (expected)"
grep -R "fallbackAppearance\\|Sản phẩm bán chạy" /root/aloha-shop/frontend/.next/server/app -l 2>/dev/null | head -8

echo DONE
`;
const conn = new Client();
conn.on("ready", () => {
  conn.exec(remoteCmd, { pty: true }, (e, stream) => {
    if (e) { console.error(e); conn.end(); process.exit(1); }
    stream.on("data", (d) => process.stdout.write(d.toString()));
    stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
    stream.on("close", (c) => { conn.end(); process.exit(c || 0); });
  });
}).on("error", (e) => { console.error(e); process.exit(1); })
.connect({ host: "160.25.167.211", port: 22, username: "root", password, readyTimeout: 60000 });
