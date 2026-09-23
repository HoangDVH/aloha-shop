/**
 * Redeploy CK fix after puppeteer install + kov_code already has " V".
 */
const { createRequire } = require("module");
const path = require("path");
const fs = require("fs");

function loadSsh2() {
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}
const { Client } = loadSsh2();

const localRoot = path.resolve(__dirname, "..");
const remoteBase = "/root/aloha-shop";
const files = [
  "backend/shopOrders/bankConfig.ts",
  "frontend/components/BankTransferQrPanel.tsx",
  "getPrivateTokenKV/auth.js",
  "getPrivateTokenKV/generateQr.js",
];

function upload(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
  });
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
        code ? reject(new Error(`exit ${code}`)) : resolve(out)
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
      for (const rel of files) {
        const local = path.join(localRoot, rel);
        const remote = `${remoteBase}/${rel.replace(/\\/g, "/")}`;
        console.log("upload", rel);
        await upload(sftp, local, remote);
      }
      await exec(
        c,
        [
          "set -e",
          `cd ${remoteBase}`,
          "pm2 restart aloha-shop-api --update-env",
          "cd frontend && npm run build",
          "pm2 restart aloha-shop --update-env",
          "sleep 3",
          "echo '=== verify generate QR ==='",
          "cd /root/aloha-shop/getPrivateTokenKV",
          "node -e \"const {generateKiotVietPaymentQr}=require('./index'); generateKiotVietPaymentQr({amount:2090,content:'bill HD022053',paymentId:'9931101233',paymentCode:'VCB'}).then(r=>{const b=r.body||r; console.log({kov:b.kov_code, ok:!!(b.image||b.qr_string)});}).catch(e=>{console.error(e.message); process.exit(1);})\"",
          "pm2 logs aloha-shop-api --lines 20 --nostream 2>/dev/null | grep -iE 'bankConfig|KiotViet|fallback|puppeteer|Đã liên kết' | tail -15 || true",
          "echo REDEPLOY_OK",
        ].join(" && ")
      );
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
c.connect({
  host: process.env.VPS_HOST || "160.25.167.211",
  port: 22,
  username: "root",
  password: process.env.VPS_PASSWORD || "aloha2026@",
});
