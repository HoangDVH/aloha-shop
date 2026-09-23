/**
 * Remove Clear-Site-Data middleware (breaks Edge CSS), rebuild shop.
 * Requires: VPS_PASSWORD
 */
const fs = require("fs");
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

const mw = fs.readFileSync(path.join(process.cwd(), "frontend/middleware.ts")).toString("base64");

const remoteCmd = `
set -e
cd /root/aloha-shop
echo '${mw}' | base64 -d > frontend/middleware.ts
cd frontend
NEXT_PUBLIC_SHOP_ORIGIN=https://alohathegioichaucay.com NEXT_PUBLIC_SITE_URL=https://alohathegioichaucay.com npm run build
pm2 restart aloha-shop --update-env
sleep 2
curl -sI https://alohathegioichaucay.com/ | tr -d '\\r' | head -20
echo FIX2_OK
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
