/**
 * Fix PM2 NEXT_PUBLIC_SHOP_ORIGIN to apex + rebuild frontend.
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
cd /root/aloha-shop
echo === before ecosystem ===
grep -n 'NEXT_PUBLIC_SHOP_ORIGIN\|SHOP_PUBLIC' frontend/ecosystem.config.cjs || true
echo === patch ecosystem if needed ===
python3 - <<'PY'
from pathlib import Path
p = Path('frontend/ecosystem.config.cjs')
t = p.read_text(encoding='utf-8')
old = 'https://shop.alohathegioichaucay.com'
new = 'https://alohathegioichaucay.com'
if old in t:
    p.write_text(t.replace(old, new), encoding='utf-8')
    print('ecosystem patched')
else:
    print('ecosystem already apex or no shop url')
print('---')
for line in p.read_text(encoding='utf-8').splitlines():
    if 'NEXT_PUBLIC' in line or 'SHOP_PUBLIC' in line or 'ORIGIN' in line:
        print(line)
PY
echo === ensure root .env ===
grep -E '^(NEXT_PUBLIC_SHOP_ORIGIN|SHOP_PUBLIC_URL|GOOGLE_REDIRECT_URI)=' .env
export NEXT_PUBLIC_SHOP_ORIGIN=https://alohathegioichaucay.com
export SHOP_PUBLIC_URL=https://alohathegioichaucay.com
cd frontend
echo === rebuild with apex origin ===
NEXT_PUBLIC_SHOP_ORIGIN=https://alohathegioichaucay.com NEXT_PUBLIC_SITE_URL=https://alohathegioichaucay.com npm run build
cd /root/aloha-shop
# reload from ecosystem so PM2 env updates
pm2 delete aloha-shop || true
cd frontend
pm2 start ecosystem.config.cjs --only aloha-shop --update-env
pm2 save
sleep 2
echo === after pm2 env ===
node <<'NODE'
const {execSync}=require('child_process');
const apps=JSON.parse(execSync('pm2 jlist',{encoding:'utf8'}));
for (const p of apps.filter(x=>String(x.name)==='aloha-shop')) {
  const e=Object.assign({}, (p.pm2_env&&p.pm2_env.env)||{}, p.pm2_env||{});
  console.log('NEXT_PUBLIC_SHOP_ORIGIN='+(e.NEXT_PUBLIC_SHOP_ORIGIN||'(missing)'));
}
NODE
echo === html canonical peek ===
curl -sL https://alohathegioichaucay.com/ | tr '\n' ' ' | grep -oE 'https?://[a-z0-9.-]*alohathegioichaucay\.com[^"'\'' ]*' | sort -u | head -30
echo FIX_OK
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
