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
cd /root/aloha-shop
node -e "const m=require('./getPrivateTokenKV'); m.generateKiotVietPaymentQr({amount:1000,content:'bill TEST',paymentId:'9931101233',paymentCode:'VCB'}).then(r=>console.log('API_PATH_OK', r.body&&r.body.kov_code)).catch(e=>console.error('API_PATH_FAIL', e.message))"
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
  host: "160.25.167.211",
  port: 22,
  username: "root",
  password: process.env.VPS_PASSWORD || "aloha2026@",
});
