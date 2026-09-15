/**
 * Hotfix: productsAdmin missing parseNhomList import → VPS.
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
  console.error("Set VPS_PASSWORD");
  process.exit(1);
}

const local = path.resolve(
  __dirname,
  "../backend/shopAppearance/productsAdmin.ts"
);
const remote = "/root/aloha-shop/backend/shopAppearance/productsAdmin.ts";

function upload(sftp, a, b) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(a, b, (err) => (err ? reject(err) : resolve()));
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
        code ? reject(new Error("exit " + code)) : resolve(out)
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
      if (!fs.existsSync(local)) throw new Error("missing local file");
      console.log("upload productsAdmin.ts");
      await upload(sftp, local, remote);
      await exec(
        c,
        "cd /root/aloha-shop && pm2 restart aloha-shop-api --update-env && sleep 2 && pm2 ls | head -15"
      );
      console.log("OK fixed parseNhomList");
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
