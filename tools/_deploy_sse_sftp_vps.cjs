/**
 * Upload via SFTP (mkdir once) then restart/build.
 * BATCH=api|fe
 */
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
const batch = process.env.BATCH || "api";

const API = [
  "backend/shopOrders/commission.ts",
  "backend/shopOrders/markPaid.ts",
  "backend/shopOrders/ctvMeRoutes.ts",
  "backend/shopOrders/completeDelivered.ts",
  "backend/shopOrders/adminOpsStream.ts",
  "backend/shop_standalone_server.ts",
];
const FE = [
  "frontend/lib/catalogSync.ts",
  "frontend/lib/authStream.ts",
  "frontend/lib/livePrices.ts",
  "frontend/lib/orders.ts",
  "frontend/lib/visibleRefetchInterval.ts",
  "frontend/components/ShopCatalogSync.tsx",
  "frontend/components/ctv-portal/panels/OverviewPanel.tsx",
  "frontend/components/ctv-portal/panels/PayoutPanel.tsx",
  "frontend/components/ctv-portal/panels/ConversionsPanel.tsx",
  "frontend/components/ctv-portal/ctvPortalQueries.ts",
  "frontend/components/ctv-portal/CtvMeStreamSync.tsx",
  "frontend/components/ctv-portal/CtvPortalShell.tsx",
  "frontend/components/admin/shell/AdminShell.tsx",
  "frontend/components/admin/shell/AdminSidebar.tsx",
  "frontend/components/admin/shell/AdminOpsSync.tsx",
  "frontend/app/(storefront)/don-hang/[code]/page.tsx",
  "docs/qa-sse-realtime-checklist.md",
  "scripts/seed-sse-realtime-qa.ts",
];

const files = batch === "fe" ? FE : API;
const keyPath = path.join(
  process.env.USERPROFILE || "",
  ".ssh",
  "id_ed25519_aloha_gha_deploy"
);

function remoteAfter() {
  if (batch === "fe") {
    return `set -e
export PATH="/usr/local/bin:/usr/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
cd /root/aloha-shop/frontend && rm -rf .next && npm run build
cd /root/aloha-shop && pm2 restart aloha-shop --update-env
sleep 2
curl -s -o /dev/null -w "home=%{http_code}\\n" "http://127.0.0.1:3002/"
echo FE_OK`;
  }
  return `set -e
pm2 restart aloha-shop-api --update-env
echo API_OK`;
}

function execDrain(c, cmd) {
  return new Promise((resolve, reject) => {
    c.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => {
        out += d;
        process.stdout.write(d);
      });
      stream.stderr.on("data", (d) => {
        out += d;
        process.stderr.write(d);
      });
      stream.on("close", (code) =>
        code ? reject(new Error(`exit ${code}: ${out}`)) : resolve(out)
      );
    });
  });
}

console.log("SFTP BATCH", batch, files.length);
const c = new Client();
c.on("ready", async () => {
  try {
    const dirs = [
      ...new Set(
        files.map((f) =>
          path.posix.dirname("/root/aloha-shop/" + f.replace(/\\/g, "/"))
        )
      ),
    ];
    await execDrain(c, `mkdir -p ${dirs.map((d) => JSON.stringify(d)).join(" ")}`);

    await new Promise((resolve, reject) => {
      c.sftp((err, sftp) => {
        if (err) return reject(err);
        let i = 0;
        const putNext = () => {
          if (i >= files.length) return resolve();
          const rel = files[i++];
          const local = path.join(process.cwd(), rel);
          const remote = "/root/aloha-shop/" + rel.replace(/\\/g, "/");
          sftp.fastPut(local, remote, (e) => {
            if (e) return reject(e);
            console.log("wrote", rel);
            putNext();
          });
        };
        putNext();
      });
    });

    await execDrain(c, remoteAfter());
    c.end();
    process.exit(0);
  } catch (e) {
    console.error(e);
    c.end();
    process.exit(1);
  }
});
c.on("error", (e) => {
  console.error(e);
  process.exit(1);
});
c.connect({
  host: "160.25.167.211",
  username: "root",
  privateKey: fs.readFileSync(keyPath),
  readyTimeout: 180000,
});
