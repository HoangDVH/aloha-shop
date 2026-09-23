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
const key = fs.readFileSync(
  path.join(process.env.USERPROFILE || "", ".ssh", "id_ed25519_aloha_gha_deploy")
);
const remoteCmd = `
set -e
cd /root/aloha-shop
echo HEAD=$(git log -1 --oneline)
# Confirm built bundle contains location.assign from search
grep -l "location.assign" frontend/.next/static/chunks/*.js 2>/dev/null | head -3 || echo 'no assign in chunks name'
# Grep source on server
grep -n "location.assign" frontend/components/SearchResultLink.tsx frontend/components/HeaderSearch.tsx
# Serve a quick check of homepage HTML for build id
curl -s 'http://127.0.0.1:3002/' | grep -oE '_next/static/chunks/[^\" ]+HeaderSearch[^\" ]*|buildId[^<]*|1704306' | head -10 || true
pm2 describe aloha-shop | grep -E 'status|cwd|script|exec' | head -15
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
  privateKey: key,
});
