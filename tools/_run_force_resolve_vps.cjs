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
const local = path.resolve(__dirname, "_force_resolve_qr_hd022053.ts");
const remote = "/root/aloha-shop/tools/_force_resolve_qr_hd022053.ts";

const c = new Client();
c.on("ready", () => {
  c.sftp(async (err, sftp) => {
    if (err) {
      console.error(err);
      c.end();
      process.exit(1);
    }
    sftp.fastPut(local, remote, (e) => {
      if (e) {
        console.error(e);
        c.end();
        process.exit(1);
      }
      c.exec(
        "set -e; cd /root/aloha-shop; export $(grep -E '^(MONGO_URI|KV_|SHOP_BANK)' .env | xargs -d '\\n' 2>/dev/null); npx --yes tsx tools/_force_resolve_qr_hd022053.ts",
        (err2, stream) => {
          if (err2) {
            console.error(err2);
            c.end();
            process.exit(1);
          }
          stream.on("data", (d) => process.stdout.write(d));
          stream.stderr.on("data", (d) => process.stderr.write(d));
          stream.on("close", (code) => {
            c.end();
            process.exit(code || 0);
          });
        }
      );
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
