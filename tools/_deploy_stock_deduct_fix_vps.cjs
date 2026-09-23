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
const keyPath = path.join(process.env.USERPROFILE || "", ".ssh", "id_ed25519_aloha_gha_deploy");
const remoteCmd = `
set -e
cd /root/aloha-shop
git fetch origin && git reset --hard origin/main
echo AFTER=$(git log -1 --oneline)
pm2 restart aloha-shop-api --update-env
sleep 2
echo DEPLOY_OK
`;
const c = new Client();
c.on("ready", () => {
  c.exec(remoteCmd, (err, stream) => {
    if (err) { console.error(err); c.end(); process.exit(1); }
    stream.on("data", (d) => process.stdout.write(d));
    stream.stderr.on("data", (d) => process.stderr.write(d));
    stream.on("close", (code) => { c.end(); process.exit(code || 0); });
  });
});
c.on("error", (e) => { console.error(e); process.exit(1); });
c.connect({ host: "160.25.167.211", username: "root", privateKey: fs.readFileSync(keyPath) });
