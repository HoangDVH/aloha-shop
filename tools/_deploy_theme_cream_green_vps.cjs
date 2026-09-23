/**
 * Deploy cream/green theme FE → VPS + build.
 *   node tools/_deploy_theme_cream_green_vps.cjs
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

function loadSsh2() {
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}
const { Client } = loadSsh2();

const files = [
  "frontend/lib/themeCss.ts",
  "frontend/lib/appearance.ts",
  "frontend/app/globals.css",
  "frontend/components/SiteChrome.tsx",
  "frontend/components/HeaderSearch.tsx",
  "frontend/components/HeaderAccountMenu.tsx",
  "frontend/components/admin/website/appearance/ShopAppearanceEditor.tsx",
];

const keyPath = path.join(
  process.env.USERPROFILE || "",
  ".ssh",
  "id_ed25519_aloha_gha_deploy"
);
const cfg = {
  host: process.env.VPS_HOST || "160.25.167.211",
  port: Number(process.env.VPS_PORT || 22),
  username: process.env.VPS_USER || "root",
};
if (fs.existsSync(keyPath)) cfg.privateKey = fs.readFileSync(keyPath);
else cfg.password = process.env.VPS_PASSWORD || "aloha2026@";

const remoteRoot = "/root/aloha-shop";
const after = `set -e
export PATH="/usr/local/bin:/usr/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
cd /root/aloha-shop/frontend && npm run build
cd /root/aloha-shop && pm2 restart aloha-shop --update-env
sleep 2
curl -s -o /dev/null -w "home=%{http_code}\\n" "http://127.0.0.1:3002/"
echo FE_OK`;

function execDrain(c, cmd) {
  return new Promise((resolve, reject) => {
    c.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on("data", (d) => process.stdout.write(d));
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", (code) =>
        code ? reject(new Error("remote_exit_" + code)) : resolve()
      );
    });
  });
}

const c = new Client();
c.on("ready", () => {
  c.sftp((err, sftp) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    let i = 0;
    const next = () => {
      if (i >= files.length) {
        execDrain(c, after)
          .then(() => {
            c.end();
          })
          .catch((e) => {
            console.error(e);
            c.end();
            process.exit(1);
          });
        return;
      }
      const rel = files[i++];
      const local = path.join(process.cwd(), rel);
      const remote = remoteRoot + "/" + rel.replace(/\\/g, "/");
      sftp.fastPut(local, remote, (e) => {
        if (e) {
          console.error("fail", rel, e.message);
          process.exit(1);
        }
        console.log("wrote", rel);
        next();
      });
    };
    console.log("THEME FE", files.length);
    next();
  });
});
c.on("error", (e) => {
  console.error(e);
  process.exit(1);
});
c.connect(cfg);
