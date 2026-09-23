/**
 * Upload shopArticles sitemap fix + rebuild shop API only (no full frontend rebuild).
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
const localFile = path.join(__dirname, "..", "backend", "shopArticles", "register.ts");
// VPS shop layout: /root/aloha-shop/backend or /root/aloha-shop/dist?
const remoteCandidates = [
  "/root/aloha-shop/backend/shopArticles/register.ts",
  "/root/aloha-shop/shopArticles/register.ts",
];

const conn = new Client();
conn
  .on("ready", () => {
    conn.sftp((err, sftp) => {
      if (err) {
        console.error(err);
        conn.end();
        process.exit(1);
      }
      const tryPut = (i) => {
        if (i >= remoteCandidates.length) {
          console.error("no remote path");
          conn.end();
          process.exit(1);
        }
        const remote = remoteCandidates[i];
        sftp.fastPut(localFile, remote, (e) => {
          if (e) {
            console.log("skip", remote, e.message);
            return tryPut(i + 1);
          }
          console.log("uploaded", remote);
          const cmd = `
set -e
cd /root/aloha-shop
# Prefer git pull if repo exists
if [ -d .git ]; then
  git fetch origin
  git reset --hard origin/main
  echo AFTER=\$(git log -1 --oneline)
fi
pm2 restart aloha-shop-api --update-env
# rebuild frontend sitemap (uses API)
cd /root/aloha-shop/frontend
npm run build
pm2 restart aloha-shop --update-env || pm2 start ecosystem.config.cjs
sleep 3
curl -sS -m 20 'http://127.0.0.1:3001/api/shop/sitemap-data' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d); const hit=(j.products||[]).find(p=>String(p.path||"").includes("tpexh")); const sp=(j.products||[]).filter(p=>String(p.path||"").startsWith("/c/sp/")).length; const real=(j.products||[]).filter(p=>/^\\/c\\/(?!sp\\/)/.test(String(p.path||""))).length; console.log(JSON.stringify({hit,sp,real,total:(j.products||[]).length},null,2));});'
echo SHOP_SITEMAP_DEPLOY_OK
`;
          conn.exec(cmd, { pty: true }, (e2, stream) => {
            if (e2) {
              console.error(e2);
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
        });
      };
      tryPut(0);
    });
  })
  .on("error", (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({ host: "160.25.167.211", port: 22, username: "root", password, readyTimeout: 60000 });
