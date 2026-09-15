/**
 * Deploy findShopOrder + orderMe/customerAction routes to VPS and restart API.
 * Requires: VPS_PASSWORD
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
  password: process.env.VPS_PASSWORD || "",
};
if (!cfg.password) {
  console.error("Set VPS_PASSWORD");
  process.exit(1);
}

const localRoot = path.resolve(__dirname, "..");
const files = [
  "backend/shopOrders/findShopOrder.ts",
  "backend/shopOrders/orderMeRoutes.ts",
  "backend/shopOrders/orderCustomerActionRoutes.ts",
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
        code ? reject(new Error(`exit ${code}: ${out}`)) : resolve(out)
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
      const remoteBase = "/root/aloha-shop";
      for (const rel of files) {
        const local = path.join(localRoot, rel);
        const remote = `${remoteBase}/${rel.replace(/\\/g, "/")}`;
        if (!fs.existsSync(local)) throw new Error("missing " + local);
        console.log("upload", rel, "->", remote);
        await upload(sftp, local, remote);
      }
      // API may run via tsx/ts-node from source, or compiled — restart both patterns
      await exec(
        c,
        `cd ${remoteBase} && pm2 restart aloha-shop-api --update-env && sleep 1 && pm2 ls | head -20`
      );
      console.log("OK deployed");
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
