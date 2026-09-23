/**
 * Audit VPS for leftover shop.* domain vs apex.
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
cd /root/aloha-shop
echo === git HEAD ===
git rev-parse --short HEAD
git log -1 --oneline
echo === env domain keys ===
for f in .env backend/.env frontend/.env; do
  if [ -f "$f" ]; then
    echo FILE=$f
    grep -E '^(SHOP_PUBLIC_URL|NEXT_PUBLIC_SHOP_ORIGIN|NEXT_PUBLIC_SITE_URL|GOOGLE_REDIRECT_URI|CORS|ALLOWED|ORIGIN)=' "$f" 2>/dev/null || true
    grep -n 'shop\\.alohathegioichaucay\\.com\\|alohathegioichaucay\\.com' "$f" 2>/dev/null | sed 's/=.*/=***/' || true
  fi
done
echo === pm2 env (shop apps) ===
pm2 jlist | node -e '
let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{
  const apps=JSON.parse(d).filter(p=>/aloha-shop/.test(p.name));
  for (const p of apps) {
    const e=p.pm2_env||{};
    const env=Object.assign({}, e.env||{}, e);
    console.log("---", p.name);
    for (const k of ["SHOP_PUBLIC_URL","NEXT_PUBLIC_SHOP_ORIGIN","NEXT_PUBLIC_SITE_URL","GOOGLE_REDIRECT_URI","PORT"]) {
      if (env[k]!=null) console.log(k+"="+env[k]);
    }
  }
});
'
echo === nginx server_name ===
grep -n 'server_name\\|ssl_certificate\\|return 301\\|proxy_pass' /etc/nginx/sites-available/aloha-shop | head -80
echo === repo leftover shop.* (code, exclude backups/.next/node_modules) ===
grep -RIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=backups --exclude-dir=.git --exclude='*.bak*' --exclude='*.pack*' 'shop\\.alohathegioichaucay\\.com' /root/aloha-shop 2>/dev/null | head -80 || echo NONE
echo === smoke ===
curl -sI https://alohathegioichaucay.com/ | head -8
curl -sI https://shop.alohathegioichaucay.com/ | head -8
echo AUDIT_OK
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
