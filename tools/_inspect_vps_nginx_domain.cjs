/**
 * Inspect nginx + certs on VPS for domain cutover.
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
echo === DNS local resolve ===
getent hosts alohathegioichaucay.com www.alohathegioichaucay.com shop.alohathegioichaucay.com || true
echo === nginx sites ===
ls -la /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null || true
echo === find shop configs ===
grep -RIl 'shop.alohathegioichaucay.com\\|aloha-shop\\|proxy_pass' /etc/nginx 2>/dev/null | head -40 || true
echo === dump matching server blocks ===
while IFS= read -r f; do
  echo FILE=$f
  echo ---
  cat "$f"
  echo ---END---
done <<EOF
$(grep -RIl 'shop.alohathegioichaucay.com' /etc/nginx 2>/dev/null || true)
EOF
echo === certbot ===
which certbot || true
certbot certificates 2>/dev/null | head -80 || true
echo === curl shop host ===
curl -sI -H 'Host: shop.alohathegioichaucay.com' http://127.0.0.1/ | head -20 || true
echo === curl apex host ===
curl -sI -H 'Host: alohathegioichaucay.com' http://127.0.0.1/ | head -20 || true
echo OK_INSPECT
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
