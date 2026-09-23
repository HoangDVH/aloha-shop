/**
 * Upload Edge/cache migration fix + HSTS, rebuild frontend on VPS.
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

const files = [
  "frontend/middleware.ts",
  "frontend/components/Providers.tsx",
  "frontend/components/SiteDataMigrationCleanup.tsx",
];

function b64(fileRel) {
  const abs = path.join(process.cwd(), fileRel);
  return fs.readFileSync(abs).toString("base64");
}

const remoteCmd = `
set -e
cd /root/aloha-shop
${files
  .map((f) => {
    const dir = path.posix.dirname(f.replace(/\\\\/g, "/"));
    return `
mkdir -p ${dir}
echo '${b64(f)}' | base64 -d > ${f.replace(/\\\\/g, "/")}
echo wrote ${f.replace(/\\\\/g, "/")}
`;
  })
  .join("\n")}

# HSTS on nginx apex + shop 443 blocks
CONF=/etc/nginx/sites-available/aloha-shop
cp -a "$CONF" "\${CONF}.bak-hsts-\$(date +%Y%m%d%H%M%S)"
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/nginx/sites-available/aloha-shop')
t = p.read_text(encoding='utf-8')
if 'Strict-Transport-Security' in t:
    print('HSTS already present')
else:
    needle = 'ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;'
    hsts = '    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;'
    if needle not in t:
        raise SystemExit('ssl_dhparam needle missing')
    parts = t.split(needle)
    out = []
    for i, part in enumerate(parts):
        out.append(part)
        if i < len(parts) - 1:
            out.append(needle + '\\n' + hsts)
    p.write_text(''.join(out), encoding='utf-8')
    print('HSTS added')
PY
nginx -t
systemctl reload nginx

cd /root/aloha-shop/frontend
NEXT_PUBLIC_SHOP_ORIGIN=https://alohathegioichaucay.com NEXT_PUBLIC_SITE_URL=https://alohathegioichaucay.com npm run build
pm2 restart aloha-shop --update-env
sleep 2
echo === verify clear-site-data header (first visit no cookie) ===
curl -sI -H 'Cookie:' https://alohathegioichaucay.com/ | tr -d '\\r' | grep -iE 'HTTP/|clear-site|strict-transport|set-cookie' | head -20
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
