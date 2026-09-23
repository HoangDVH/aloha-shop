/**
 * Deploy + đảm bảo SHOP_API_INTERNAL=3001.
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
echo BEFORE=$(git rev-parse --short HEAD)
git fetch origin
git reset --hard origin/main
echo AFTER=$(git rev-parse --short HEAD) $(git log -1 --oneline)
pm2 restart aloha-shop-api --update-env
cd frontend
npm run build
# Reload ecosystem để nhận SHOP_API_INTERNAL=3001
pm2 delete aloha-shop || true
pm2 start ecosystem.config.cjs
sleep 3
pm2 ls | head -20
echo "SHOP_API_INTERNAL=$(pm2 env $(pm2 jlist | node -e 'let d=\"\";process.stdin.on(\"data\",c=>d+=c);process.stdin.on(\"end\",()=>{const a=JSON.parse(d).find(p=>p.name===\"aloha-shop\"); console.log(a?a.pm_id:\"\")}') 2>/dev/null | grep SHOP_API_INTERNAL || true)"
curl -sI "http://127.0.0.1:3002/danh-muc/cay-phong-thuy" | head -5
curl -s "http://127.0.0.1:3002/danh-muc/cay-phong-thuy" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const m=d.match(/(\\d{2,5})\\s*sản phẩm/); const t=d.match(/Trang\\s*\\d+\\/(\\d+)/); console.log("count=", m&&m[1], "pages=", t&&t[1]); console.log("has_tape=", /BĂNG KEO|BANG KEO/i.test(d));})'
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
