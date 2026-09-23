/**
 * Fix VPS: install puppeteer for getPrivateTokenKV so KOV QR works (not HD-only fallback).
 */
const { createRequire } = require("module");
const path = require("path");

function loadSsh2() {
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}
const { Client } = loadSsh2();

const remoteCmd = `
set -e
cd /root/aloha-shop/getPrivateTokenKV
echo '=== before ==='
ls -la node_modules/puppeteer 2>/dev/null | head -3 || echo 'NO puppeteer'
ls -la .token_cache.json 2>/dev/null || echo 'NO token cache'
ls -la .env 2>/dev/null || echo 'NO getPrivateTokenKV/.env'
# Prefer Chromium already on system if any
export PUPPETEER_SKIP_DOWNLOAD=false
npm install --omit=dev
echo '=== after puppeteer ==='
node -e "require('puppeteer'); console.log('puppeteer OK', require('puppeteer/package.json').version)"
# Quick QR smoke if env present
node <<'NODE'
const fs = require('fs');
function loadEnv(p) {
  try {
    for (const line of fs.readFileSync(p,'utf8').split(/\\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
    }
  } catch {}
}
loadEnv('/root/aloha-shop/.env');
loadEnv('/root/aloha-shop/getPrivateTokenKV/.env');
(async () => {
  try {
    const { generateKiotVietPaymentQr } = require('./index.js');
    const res = await generateKiotVietPaymentQr({
      amount: 2090,
      content: 'bill HD022053',
      paymentId: process.env.KV_PAYMENT_ID || '9931101233',
      paymentCode: process.env.KV_PAYMENT_CODE || 'VCB',
    });
    const body = res && res.body ? res.body : res;
    console.log('SMOKE', {
      kov: body && body.kov_code,
      hasImage: !!(body && body.image),
      hasQr: !!(body && body.qr_string),
    });
  } catch (e) {
    console.error('SMOKE_FAIL', e && e.message ? e.message : e);
    process.exitCode = 2;
  }
})();
NODE
pm2 restart aloha-shop-api --update-env
sleep 2
pm2 logs aloha-shop-api --lines 15 --nostream | tail -20
echo FIX_PUPPETEER_OK
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
c.connect({
  host: process.env.VPS_HOST || "160.25.167.211",
  port: Number(process.env.VPS_PORT || 22),
  username: process.env.VPS_USER || "root",
  password: process.env.VPS_PASSWORD || "aloha2026@",
});
