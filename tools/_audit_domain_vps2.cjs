/**
 * Audit VPS leftover domain (part 2).
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
echo === pm2 env keys ===
node <<'NODE'
const {execSync}=require('child_process');
const apps=JSON.parse(execSync('pm2 jlist',{encoding:'utf8'}));
for (const p of apps.filter(x=>String(x.name).includes('aloha-shop'))) {
  const e=Object.assign({}, (p.pm2_env&&p.pm2_env.env)||{}, p.pm2_env||{});
  console.log('---', p.name);
  for (const k of ['SHOP_PUBLIC_URL','NEXT_PUBLIC_SHOP_ORIGIN','NEXT_PUBLIC_SITE_URL','GOOGLE_REDIRECT_URI','PORT']) {
    if (e[k]!=null) console.log(k+'='+e[k]);
  }
}
NODE
echo === nginx server_name lines ===
grep -nE 'server_name|return 301|ssl_certificate ' /etc/nginx/sites-available/aloha-shop
echo === repo leftover shop subdomain in live code ===
grep -RIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=backups --exclude-dir=.git --exclude='*.bak*' 'shop\.alohathegioichaucay\.com' . 2>/dev/null | head -60 || echo NONE
echo === smoke ===
curl -sI https://alohathegioichaucay.com/ | sed -n '1,6p'
curl -sI https://shop.alohathegioichaucay.com/ | sed -n '1,6p'
echo AUDIT2_OK
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
