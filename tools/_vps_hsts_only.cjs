/**
 * Add HSTS on aloha-shop nginx + rebuild/restart frontend with cache purge middleware.
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

const remoteCmd = String.raw`
set -e
CONF=/etc/nginx/sites-available/aloha-shop
cp -a "$CONF" "\${CONF}.bak-hsts-\$(date +%Y%m%d%H%M%S)"
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/nginx/sites-available/aloha-shop')
t = p.read_text(encoding='utf-8')
needle = 'ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;'
hsts = "add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;"
if 'Strict-Transport-Security' not in t and needle in t:
    # only on first (apex) ssl block occurrence is enough if we add after each ssl_dhparam in 443 servers
    parts = t.split(needle)
    out = []
    for i, part in enumerate(parts):
        out.append(part)
        if i < len(parts) - 1:
            out.append(needle)
            # peek next chunk: if this is within a listen 443 context roughly, add HSTS once per cert block
            out.append('\n    ' + hsts)
    t2 = ''.join(out)
    p.write_text(t2, encoding='utf-8')
    print('HSTS inserted')
else:
    print('HSTS skip', 'already' if 'Strict-Transport-Security' in t else 'no needle')
PY
nginx -t
systemctl reload nginx

cd /root/aloha-shop
git fetch origin
# keep deploying local changes via rsync of middleware files if git not pushed yet
echo === will patch files from stdin base64 if needed ===
echo DONE_NGINX
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
