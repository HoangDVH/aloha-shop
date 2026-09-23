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
const key = fs.readFileSync(
  path.join(process.env.USERPROFILE || "", ".ssh", "id_ed25519_aloha_gha_deploy")
);
const remoteCmd = `
set -e
cd /root/aloha-shop/frontend
# Find assign in built JS
FOUND=$(grep -Rsl "location.assign\\|/sp/\\" .next/static/chunks/*.js 2>/dev/null | head -5 || true)
echo "FOUND_FILES=$FOUND"
# Sample grep
grep -Roh "location\\.assign([^)]{0,40})" .next/static/chunks/*.js 2>/dev/null | head -5 || echo 'no location.assign string'
grep -Roh "Đang mở sản phẩm" .next/server/app/**/*.js 2>/dev/null | head -3 || true
# Test /sp/TNM2L response
curl -sI 'http://127.0.0.1:3002/sp/TNM2L' | head -15
curl -s 'http://127.0.0.1:3002/sp/TNM2L' | grep -oE 'Đang mở|ShareRedirect|thiet-bi-vat-dung|/c/[^\"<> ]+tnm2l[^\"<> ]*' | head -20
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
  username: "root",
  privateKey: key,
});
