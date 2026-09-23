/**
 * Fix prod 500: rebuild Next on VPS (purge Windows-tainted .next) + ensure API deps + restart.
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

function loadSsh2() {
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}

const { Client } = loadSsh2();
const keyPath =
  process.env.VPS_SSH_KEY ||
  path.join(process.env.USERPROFILE || "", ".ssh", "id_ed25519_aloha_gha_deploy");

const cfg = {
  host: process.env.VPS_HOST || "160.25.167.211",
  port: Number(process.env.VPS_PORT || 22),
  username: process.env.VPS_USER || "root",
  privateKey: fs.readFileSync(keyPath),
  readyTimeout: 30000,
};

const remoteCmd = `
set -e
export PATH="/usr/local/bin:/usr/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
cd /root/aloha-shop
git fetch origin
git reset --hard origin/main
echo AFTER=$(git log -1 --oneline)

# API deps (swagger-ui-express historically missing)
npm install --no-audit --no-fund
pm2 restart aloha-shop-api --update-env

cd frontend
# Drop Windows-tainted .next that embeds D:\\\\Documents paths in middleware
rm -rf .next
npm install --no-audit --no-fund
npm run build
cd ..

pm2 restart aloha-shop --update-env
sleep 3
pm2 ls | head -20

# smoke
curl -s -o /dev/null -w "health=%{http_code}\\n" http://127.0.0.1:3001/api/health || true
curl -s -o /dev/null -w "admin_home=%{http_code}\\n" http://127.0.0.1:3002/admin/ctv || true
curl -s -o /dev/null -w "ctv_detail=%{http_code}\\n" "http://127.0.0.1:3002/admin/ctv/danh-sach/QASTATPAID" || true
# check middleware path not Windows
if grep -R "D:\\\\\\\\Documents" frontend/.next/server/middleware.js >/dev/null 2>&1; then
  echo "WARN still has Windows path in middleware"
else
  echo "middleware_path_ok"
fi
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
