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
echo "=== env of aloha-shop ==="
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const p=JSON.parse(d).find(x=>x.name==="aloha-shop"); const e=p.pm2_env||{}; console.log(JSON.stringify({cwd:e.pm_cwd, SHOP_API_INTERNAL:(e.env||{}).SHOP_API_INTERNAL, NEXT_PUBLIC_API_BASE:(e.env||{}).NEXT_PUBLIC_API_BASE, PORT:(e.env||{}).PORT},null,2));})'

echo "=== clear next cache + restart ==="
cd /root/aloha-shop/frontend
rm -rf .next/cache || true
pm2 restart aloha-shop --update-env
sleep 4

echo "=== warm homepage ==="
curl -sS -m 25 http://127.0.0.1:3002/ -o /tmp/home3.html
node <<'NODE'
const fs = require("fs");
const d = fs.readFileSync("/tmp/home3.html", "utf8");
const checks = ["Sản phẩm bán chạy", "Cây thành phẩm", "BÌNH CẤM HOA", "Bài viết", "Bài viết mới"];
for (const c of checks) console.log(c + "=" + d.includes(c));
const m = [...d.matchAll(/B[ÌI]NH|C[ẤA]M HOA|thành phẩm|bán chạy|Bài viết/gi)].map(x => x[0]);
console.log("matches", [...new Set(m)].slice(0, 20));
console.log("len", d.length);
NODE

echo "=== domain ==="
curl -sS -m 25 -H "Cache-Control: no-cache" "https://alohathegioichaucay.com/?_=$(date +%s)" -o /tmp/home4.html
node <<'NODE'
const fs = require("fs");
const d = fs.readFileSync("/tmp/home4.html", "utf8");
const checks = ["Sản phẩm bán chạy", "Cây thành phẩm", "BÌNH CẤM HOA", "Bài viết"];
for (const c of checks) console.log("DOM " + c + "=" + d.includes(c));
NODE

echo "=== DONE ==="
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
