/** Deploy batch: set BATCH=api|fe */
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

function b64(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel)).toString("base64");
}

const writeCmds = files
  .map((f) => {
    const posix = f.replace(/\\/g, "/");
    const dir = path.posix.dirname(posix);
    return `mkdir -p /root/aloha-shop/${dir}\necho '${b64(f)}' | base64 -d > /root/aloha-shop/${posix}\necho wrote ${posix}`;
  })
  .join("\n");

const remoteCmd =
  batch === "fe"
    ? `
set -e
export PATH="/usr/local/bin:/usr/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
cd /root/aloha-shop
${writeCmds}
cd frontend
rm -rf .next
npm run build
cd ..
pm2 restart aloha-shop --update-env
sleep 2
curl -s -o /dev/null -w "home=%{http_code}\\n" "http://127.0.0.1:3002/"
echo FE_OK
`
    : `
set -e
cd /root/aloha-shop
${writeCmds}
pm2 restart aloha-shop-api --update-env
echo API_OK
`;

const keyPath = path.join(
  process.env.USERPROFILE || "",
  ".ssh",
  "id_ed25519_aloha_gha_deploy"
);
console.log("BATCH", batch, "files", files.length);
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
c.connect({
  host: "160.25.167.211",
  username: "root",
  privateKey: fs.readFileSync(keyPath),
  readyTimeout: 180000,
});
