/**
 * Deploy shop frontend/backend từ origin/main.
 * Requires: VPS_PASSWORD
 */
const path = require("path");
function loadSsh2() {
  const { createRequire } = require("module");
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}
const { Client } = loadSsh2();
const cfg = {
  host: process.env.VPS_HOST || "160.25.167.211",
  port: Number(process.env.VPS_PORT || 22),
  username: process.env.VPS_USER || "root",
  password: process.env.VPS_PASSWORD || process.env.VPS_SSH_PASSWORD || "",
};
if (!cfg.password) {
  console.error("Set VPS_PASSWORD");
  process.exit(1);
}
const remoteCmd = `
set -e
cd /root/aloha-shop
git fetch origin
git reset --hard origin/main
echo AFTER=$(git log -1 --oneline)
pm2 restart aloha-shop-api --update-env
cd frontend
npm run build
pm2 delete aloha-shop || true
pm2 start ecosystem.config.cjs
pm2 save
sleep 2
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const p=JSON.parse(d||"[]").find(x=>x.name==="aloha-shop"); if(!p){console.error("aloha-shop missing"); process.exit(1);} const cwd=p.pm2_env.pm_cwd||""; console.log("aloha-shop cwd="+cwd); if(!cwd.includes("/root/aloha-shop/frontend")){console.error("WRONG_CWD expected /root/aloha-shop/frontend"); process.exit(2);} })'
pm2 ls | head -15
echo DEPLOY_OK
`;
const c = new Client();
c.on("ready", () => {
  c.exec(remoteCmd, (err, stream) => {
    if (err) {
      console.error(err);
      c.end();
      process.exit(1);
    }
    stream.on("data", (d) => process.stdout.write(d));
    stream.stderr.on("data", (d) => process.stderr.write(d));
    stream.on("close", (code) => {
      c.end();
      process.exit(code || 0);
    });
  });
});
c.on("error", (e) => {
  console.error(e);
  process.exit(1);
});
c.connect(cfg);
