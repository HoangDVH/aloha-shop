/**
 * Upload Google Search Console HTML verification file to VPS public/.
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

const b64 = fs
  .readFileSync(
    path.join(process.cwd(), "frontend/public/google22f3b0d7348b057d.html")
  )
  .toString("base64");

const remoteCmd = [
  "set -e",
  "mkdir -p /root/aloha-shop/frontend/public",
  `echo '${b64}' | base64 -d > /root/aloha-shop/frontend/public/google22f3b0d7348b057d.html`,
  "chmod 644 /root/aloha-shop/frontend/public/google22f3b0d7348b057d.html",
  "cd /root/aloha-shop/frontend && pm2 restart aloha-shop --update-env",
  "sleep 3",
  "curl -sI https://alohathegioichaucay.com/google22f3b0d7348b057d.html | head -15",
  "echo BODY:",
  "curl -s https://alohathegioichaucay.com/google22f3b0d7348b057d.html",
  "echo",
  "echo VERIFY_FILE_OK",
].join("\n");

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
