/**
 * Upload search 1-click fix → VPS, rebuild frontend, restart.
 * Auth: SSH key id_ed25519_aloha_gha_deploy (or VPS_PASSWORD).
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

const files = [
  "frontend/components/admin/ctv/CtvAdminShell.tsx",
];

function b64(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel)).toString("base64");
}

const writeCmds = files
  .map((f) => {
    const posix = f.replace(/\\/g, "/");
    const dir = path.posix.dirname(posix);
    return `mkdir -p /root/aloha-shop/${dir}\necho '${b64(f)}' | base64 -d > /root/aloha-shop/${posix}\necho wrote ${posix}`;
  })
  .join("\n");

const remoteCmd = `
set -e
export PATH="/usr/local/bin:/usr/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
cd /root/aloha-shop
${writeCmds}
cd frontend
rm -rf .next
npm run build
cd ..
pm2 restart aloha-shop --update-env
sleep 2
curl -s -o /dev/null -w "home=%{http_code}\\n" "http://127.0.0.1:3002/"
# smoke: bundle must contain deferred location.href hard-nav
grep -Rsl 'location.href' .next/static/chunks/app/\\(storefront\\)/layout-*.js | head -1 || true
echo DEPLOY_OK
`;

const keyPath = path.join(
  process.env.USERPROFILE || "",
  ".ssh",
  "id_ed25519_aloha_gha_deploy"
);
const password = process.env.VPS_PASSWORD || process.env.VPS_SSH_PASSWORD || "";
const connect = {
  host: process.env.VPS_HOST || "160.25.167.211",
  username: process.env.VPS_USER || "root",
  readyTimeout: 60000,
};
if (fs.existsSync(keyPath)) connect.privateKey = fs.readFileSync(keyPath);
else if (password) connect.password = password;
else {
  console.error("Need SSH key or VPS_PASSWORD");
  process.exit(1);
}

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
c.connect(connect);
