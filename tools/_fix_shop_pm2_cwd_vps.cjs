/**
 * Fix: aloha-shop PM2 đang chạy monorepo cũ.
 * Chuyển về /root/aloha-shop/frontend (standalone đã deploy).
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
echo "=== BEFORE ==="
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{for(const p of JSON.parse(d||"[]")){if(p.name==="aloha-shop") console.log("cwd="+p.pm2_env.pm_cwd+" script="+p.pm2_env.pm_exec_path)}})'

echo "=== switch to standalone frontend ==="
pm2 delete aloha-shop || true
cd /root/aloha-shop/frontend
test -f .next/BUILD_ID
test -f ecosystem.config.cjs
pm2 start ecosystem.config.cjs
pm2 save

sleep 3
echo "=== AFTER ==="
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{for(const p of JSON.parse(d||"[]")){if(/aloha-shop/.test(p.name)) console.log(p.name,p.pm2_env.status,"cwd="+p.pm2_env.pm_cwd)}})'

echo "=== homepage check ==="
ok=0
for i in 1 2 3 4 5 6 8 10; do
  if curl -sf --max-time 8 http://127.0.0.1:3002/ >/tmp/home.html; then ok=1; break; fi
  sleep 2
done
test "\$ok" = "1"
node -e '
const d=require("fs").readFileSync("/tmp/home.html","utf8");
const checks=["Sản phẩm bán chạy","Cây thành phẩm","BÌNH CẤM HOA","Bài viết"];
const out={};
for (const c of checks) out[c]=d.includes(c);
console.log(JSON.stringify(out,null,2));
';

curl -sS -m 20 -H "Cache-Control: no-cache" https://alohathegioichaucay.com/ | node -e '
let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{
  const checks=["Sản phẩm bán chạy","Cây thành phẩm","BÌNH CẤM HOA","Bài viết"];
  const out={};
  for (const c of checks) out[c]=d.includes(c);
  console.log("DOMAIN", JSON.stringify(out));
});'

echo "=== FIX_SHOP_PROCESS_OK ==="
`;

const conn = new Client();
conn
  .on("ready", () => {
    console.log("SSH OK — fix aloha-shop cwd");
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
