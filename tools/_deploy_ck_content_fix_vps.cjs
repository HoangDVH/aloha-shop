/**
 * Deploy ONLY nội dung CK (KOV) fix — không đụng CTV.
 * Upload file liên quan + restart API + rebuild frontend.
 * Requires: VPS_PASSWORD (hoặc mặc định local)
 */
const { createRequire } = require("module");
const path = require("path");
const fs = require("fs");

function loadSsh2() {
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
  password:
    process.env.VPS_PASSWORD ||
    process.env.VPS_SSH_PASSWORD ||
    "aloha2026@",
};
if (!cfg.password) {
  console.error("Set VPS_PASSWORD");
  process.exit(1);
}

const localRoot = path.resolve(__dirname, "..");
const remoteBase = "/root/aloha-shop";

/** Chỉ các file sửa nội dung CK — KHÔNG gồm CTV admin/API. */
const files = [
  "backend/shopOrders/bankConfig.ts",
  "frontend/components/BankTransferQrPanel.tsx",
  "frontend/components/OrdersPanel.tsx",
  "frontend/app/(storefront)/don-hang/[code]/page.tsx",
  "getPrivateTokenKV/generateQr.js",
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

async function ensureRemoteDir(sftp, remoteFile) {
  const parts = remoteFile.replace(/\\/g, "/").split("/");
  parts.pop();
  let cur = "";
  for (const p of parts) {
    if (!p) continue;
    cur += "/" + p;
    await mkdirp(sftp, cur);
  }
}

function exec(client, cmd) {
  return new Promise((resolve, reject) => {
    client.exec(cmd, (err, stream) => {
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
        code ? reject(new Error(`exit ${code}: ${out.slice(-800)}`)) : resolve(out)
      );
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
      console.log("=== Deploy CK content fix ONLY (no CTV) ===");
      for (const rel of files) {
        const local = path.join(localRoot, rel);
        const remote = `${remoteBase}/${rel.replace(/\\/g, "/")}`;
        if (!fs.existsSync(local)) throw new Error("missing " + local);
        await ensureRemoteDir(sftp, remote);
        console.log("upload", rel);
        await upload(sftp, local, remote);
      }

      console.log("\n=== Restart API + rebuild frontend ===");
      await exec(
        c,
        [
          "set -e",
          `cd ${remoteBase}`,
          "pm2 restart aloha-shop-api --update-env",
          "cd frontend",
          "npm run build",
          "pm2 restart aloha-shop --update-env || (pm2 delete aloha-shop || true; pm2 start ecosystem.config.cjs)",
          "sleep 2",
          "pm2 ls | head -20",
          "echo DEPLOY_CK_OK",
        ].join(" && ")
      );
      console.log("\nOK — chỉ CK content, không deploy CTV");
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
