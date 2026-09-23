/**
 * Pull + rebuild frontend only (UI list ctvLines trên tab Kỳ tháng).
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

const remoteCmd = `
set -e
export PATH="/usr/local/bin:/usr/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
cd /root/aloha-shop
git fetch origin
git reset --hard origin/main
echo AFTER=$(git log -1 --oneline)
cd frontend
rm -rf .next
npm run build
cd ..
pm2 restart aloha-shop --update-env
sleep 2
curl -s -o /dev/null -w "hoa_hong=%{http_code}\\n" http://127.0.0.1:3002/admin/ctv/hoa-hong || true
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
c.connect({
  host: process.env.VPS_HOST || "160.25.167.211",
  username: process.env.VPS_USER || "root",
  privateKey: fs.readFileSync(keyPath),
  readyTimeout: 30000,
});
