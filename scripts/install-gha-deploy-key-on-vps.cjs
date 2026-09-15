/**
 * Cài public key GHA deploy lên VPS authorized_keys.
 * Env: VPS_PASSWORD, optional VPS_HOST / VPS_USER / PUB_KEY_PATH
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

function loadSsh2() {
  const { createRequire } = require("module");
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}

const { Client } = loadSsh2();
const pubPath =
  process.env.PUB_KEY_PATH ||
  path.join(os.homedir(), ".ssh", "id_ed25519_aloha_gha_deploy.pub");
const pub = fs.readFileSync(pubPath, "utf8").trim();
const cfg = {
  host: process.env.VPS_HOST || "160.25.167.211",
  port: 22,
  username: process.env.VPS_USER || "root",
  password: process.env.VPS_PASSWORD || process.env.VPS_SSH_PASSWORD || "",
};
if (!cfg.password) {
  console.error("Set VPS_PASSWORD");
  process.exit(1);
}

const remote = [
  "mkdir -p ~/.ssh",
  "chmod 700 ~/.ssh",
  "touch ~/.ssh/authorized_keys",
  "chmod 600 ~/.ssh/authorized_keys",
  `grep -qxF ${JSON.stringify(pub)} ~/.ssh/authorized_keys || echo ${JSON.stringify(pub)} >> ~/.ssh/authorized_keys`,
  "echo KEY_INSTALLED",
].join(" && ");

const c = new Client();
c.on("ready", () => {
  c.exec(remote, (err, stream) => {
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
c.connect(cfg);
