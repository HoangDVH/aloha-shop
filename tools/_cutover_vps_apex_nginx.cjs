/**
 * Cutover nginx: alohathegioichaucay.com -> shop (3002/3001),
 * redirect shop.* -> apex. Reuse existing Let's Encrypt certs.
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

const nginxConf = `# Web ban ALOHA — domain chinh + redirect shop.*
# Generated ${new Date().toISOString()}

# Domain chinh (HTTPS)
server {
    listen 443 ssl;
    server_name alohathegioichaucay.com;

    client_max_body_size 20M;

    ssl_certificate /etc/letsencrypt/live/alohathegioichaucay.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/alohathegioichaucay.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location /uploads/ {
        proxy_pass http://127.0.0.1:3001/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/auth/ {
        proxy_pass http://127.0.0.1:3001/api/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/shop/ {
        proxy_pass http://127.0.0.1:3001/api/shop/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# shop subdomain -> domain chinh (HTTPS)
server {
    listen 443 ssl;
    server_name shop.alohathegioichaucay.com;

    ssl_certificate /etc/letsencrypt/live/shop.alohathegioichaucay.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shop.alohathegioichaucay.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://alohathegioichaucay.com$request_uri;
}

# HTTP -> HTTPS domain chinh
server {
    listen 80;
    server_name alohathegioichaucay.com shop.alohathegioichaucay.com;
    return 301 https://alohathegioichaucay.com$request_uri;
}
`;

const b64 = Buffer.from(nginxConf, "utf8").toString("base64");

const remoteCmd = `
set -e
CONF=/etc/nginx/sites-available/aloha-shop
cp -a "$CONF" "\${CONF}.bak-apex-\$(date +%Y%m%d%H%M%S)"
echo '${b64}' | base64 -d > "$CONF"
nginx -t
systemctl reload nginx
echo === restart pm2 shop with env ===
cd /root/aloha-shop
pm2 restart aloha-shop-api --update-env || true
pm2 restart aloha-shop --update-env || true
sleep 2
echo === smoke apex https ===
curl -sI https://alohathegioichaucay.com/ | head -20
echo === smoke shop redirect ===
curl -sI https://shop.alohathegioichaucay.com/ | head -20
echo === smoke api ===
curl -sI https://alohathegioichaucay.com/api/shop/health 2>/dev/null | head -15 || curl -sI https://alohathegioichaucay.com/api/health 2>/dev/null | head -15 || true
echo === title peek ===
curl -sL https://alohathegioichaucay.com/ | tr '\\n' ' ' | grep -oE '<title>[^<]+</title>' | head -3 || true
echo CUTOVER_OK
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
