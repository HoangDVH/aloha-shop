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
cd /root/aloha-shop
git log -1 --oneline
grep -n "router.push(href)" frontend/components/SearchResultLink.tsx || echo MISSING_FIX
ls frontend/.next/BUILD_ID 2>/dev/null; cat frontend/.next/BUILD_ID 2>/dev/null
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
