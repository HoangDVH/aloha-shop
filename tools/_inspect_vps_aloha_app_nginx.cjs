/**
 * Dump aloha-app nginx + check www DNS / existing apex usage.
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
echo === aloha-app config ===
cat /etc/nginx/sites-available/aloha-app
echo ===END===
echo === cert domains detail ===
openssl x509 -in /etc/letsencrypt/live/alohathegioichaucay.com/fullchain.pem -noout -text 2>/dev/null | grep -A1 'Subject Alternative Name' || true
echo === www resolve ===
getent hosts www.alohathegioichaucay.com || echo WWW_NO_DNS
dig +short www.alohathegioichaucay.com A || true
echo === pm2 ports ===
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{JSON.parse(d).forEach(p=>console.log(p.name,p.pm2_env.status,"port?", (p.pm2_env.env&& (p.pm2_env.env.PORT||p.pm2_env.env.port))||"-"))})'
echo OK
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
