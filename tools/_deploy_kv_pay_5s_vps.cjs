/**
 * Deploy pay-reconcile 5s fix: pull + restart API + rebuild FE + set env.
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
const keyPath = path.join(
  process.env.USERPROFILE || "",
  ".ssh",
  "id_ed25519_aloha_gha_deploy"
);

const remoteCmd = `
set -e
export PATH="/usr/local/bin:/usr/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
cd /root/aloha-shop

# Ensure 5s reconcile on VPS
if grep -q '^SHOP_KV_PAY_RECONCILE_MS=' .env 2>/dev/null; then
  sed -i 's/^SHOP_KV_PAY_RECONCILE_MS=.*/SHOP_KV_PAY_RECONCILE_MS=5000/' .env
else
  echo 'SHOP_KV_PAY_RECONCILE_MS=5000' >> .env
fi
if grep -q '^SHOP_KV_PAY_RECONCILE=' .env 2>/dev/null; then
  sed -i 's/^SHOP_KV_PAY_RECONCILE=.*/SHOP_KV_PAY_RECONCILE=1/' .env
else
  echo 'SHOP_KV_PAY_RECONCILE=1' >> .env
fi
grep -E 'SHOP_KV_PAY' .env || true

git fetch origin
git reset --hard origin/main
echo AFTER=$(git log -1 --oneline)

pm2 restart aloha-shop-api --update-env
cd frontend
rm -rf .next
npm run build
cd ..
pm2 restart aloha-shop --update-env
sleep 2
pm2 logs aloha-shop-api --lines 15 --nostream 2>&1 | grep -i kv-pay | tail -5 || true
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
  host: "160.25.167.211",
  username: "root",
  privateKey: fs.readFileSync(keyPath),
  readyTimeout: 30000,
});
