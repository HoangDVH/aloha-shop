/**
 * Deploy webKm (BE + FE admin/storefront) → VPS /root/aloha-shop + restart.
 * Env: VPS_PASSWORD or VPS_SSH_PASSWORD
 */
const fs = require("fs");
const path = require("path");

function loadSsh2() {
  const { createRequire } = require("module");
  try {
    return createRequire(__filename)("ssh2");
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
  console.error("Set VPS_PASSWORD or VPS_SSH_PASSWORD");
  process.exit(1);
}

const localRoot = path.resolve(__dirname, "..");
const remoteBase = "/root/aloha-shop";

const files = [
  // backend
  "backend/shopCatalog/webKm.ts",
  "backend/shopCatalog/register.ts",
  "backend/shopOrders/orderRouteShared.ts",
  "backend/shopAppearance/productsAdmin.ts",
  // frontend lib
  "frontend/lib/webKmForm.ts",
  "frontend/lib/api.ts",
  "frontend/lib/cart.ts",
  "frontend/lib/cartPriceRefresh.ts",
  "frontend/lib/livePrices.ts",
  // storefront
  "frontend/components/ProductPrice.tsx",
  "frontend/components/ProductCard.tsx",
  "frontend/components/ProductDetailView.tsx",
  "frontend/components/SearchResultLink.tsx",
  "frontend/components/checkout/CheckoutLineItems.tsx",
  "frontend/app/(storefront)/gio-hang/page.tsx",
  // admin
  "frontend/components/admin/website/products/ShopWebProductsAdmin.tsx",
  "frontend/components/admin/website/products/ProductWebKmEditor.tsx",
  "frontend/components/admin/website/products/WebKmBulkBar.tsx",
];

function upload(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
  });
}

function mkdirp(sftp, dir) {
  return new Promise((resolve) => {
    sftp.mkdir(dir, { mode: 0o755 }, () => resolve());
  });
}

async function ensureRemoteDirs(sftp, rel) {
  const parts = rel.replace(/\\/g, "/").split("/");
  let cur = remoteBase;
  for (let i = 0; i < parts.length - 1; i++) {
    cur += "/" + parts[i];
    await mkdirp(sftp, cur);
  }
}

function exec(client, cmd, timeoutMs = 900000) {
  return new Promise((resolve, reject) => {
    client.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      const t = setTimeout(() => {
        try {
          stream.close();
        } catch {}
        reject(new Error("timeout: " + cmd.slice(0, 80)));
      }, timeoutMs);
      stream.on("data", (d) => {
        out += d;
        process.stdout.write(d);
      });
      stream.stderr.on("data", (d) => {
        out += d;
        process.stderr.write(d);
      });
      stream.on("close", (code) => {
        clearTimeout(t);
        code ? reject(new Error(`exit ${code}`)) : resolve(out);
      });
    });
  });
}

const c = new Client();
c.on("ready", () => {
  c.sftp(async (err, sftp) => {
    if (err) {
      console.error(err);
      c.end();
      process.exit(1);
    }
    try {
      for (const rel of files) {
        const local = path.join(localRoot, rel);
        if (!fs.existsSync(local)) throw new Error("missing " + local);
        const remote = `${remoteBase}/${rel.replace(/\\/g, "/")}`;
        await ensureRemoteDirs(sftp, rel);
        console.log("upload", rel);
        await upload(sftp, local, remote);
      }

      console.log("\n=== restart API ===");
      await exec(
        c,
        `cd ${remoteBase} && pm2 restart aloha-shop-api --update-env && sleep 2 && pm2 ls | head -30`
      );

      console.log("\n=== build + restart frontend ===");
      await exec(
        c,
        [
          `cd ${remoteBase}/frontend`,
          `if [ -f package.json ]; then`,
          `  npm run build`,
          `  pm2 restart aloha-shop-web --update-env || pm2 restart aloha-shop-frontend --update-env || pm2 restart aloha-shop --update-env || true`,
          `  sleep 2`,
          `  pm2 ls | head -40`,
          `else`,
          `  echo NO_FRONTEND_PACKAGE`,
          `fi`,
        ].join("\n")
      );

      console.log("\n=== verify webKm on VPS ===");
      await exec(
        c,
        `test -f ${remoteBase}/backend/shopCatalog/webKm.ts && echo HAS_webKm.ts || echo MISSING_webKm; grep -n "webKm" ${remoteBase}/backend/shopAppearance/productsAdmin.ts | head -5`
      );

      console.log("\nOK deployed webKm");
      c.end();
    } catch (e) {
      console.error(e);
      c.end();
      process.exit(1);
    }
  });
});
c.on("error", (e) => {
  console.error(e);
  process.exit(1);
});
c.connect(cfg);
