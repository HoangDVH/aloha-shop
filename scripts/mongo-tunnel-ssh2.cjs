/**
 * Mongo tunnel VPS -> local :27018 via ssh2 (không cần giữ cửa sổ ssh).
 * Env:
 *   VPS_HOST (default 160.25.167.211)
 *   VPS_SSH_PASSWORD  — bắt buộc nếu chưa có key
 *   VPS_SSH_KEY       — path private key (ưu tiên hơn password)
 *   LOCAL_MONGO_PORT  — default 27018
 *
 * Chạy nền: node scripts/mongo-tunnel-ssh2.cjs
 */
const net = require("net");
const fs = require("fs");
const path = require("path");

try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {
  /* optional */
}

let Client;
try {
  Client = require("ssh2").Client;
} catch {
  try {
    Client = require(path.join(
      process.env.USERPROFILE || "",
      "ALOHA-GARDEN-2",
      "node_modules",
      "ssh2"
    )).Client;
  } catch {
    console.error("Thiếu package ssh2. Cài: npm i ssh2");
    process.exit(1);
  }
}

const host = process.env.VPS_HOST || "160.25.167.211";
const user = process.env.VPS_SSH_USER || "root";
const localPort = Number(process.env.LOCAL_MONGO_PORT || 27018);
const remoteHost = "127.0.0.1";
const remotePort = 27017;
const keyPath =
  process.env.VPS_SSH_KEY ||
  path.join(process.env.USERPROFILE || "", ".ssh", "id_ed25519_aloha_vps");

const cfg = {
  host,
  port: 22,
  username: user,
  readyTimeout: 20000,
  keepaliveInterval: 15000,
};

if (fs.existsSync(keyPath)) {
  cfg.privateKey = fs.readFileSync(keyPath);
  console.log("Dùng SSH key:", keyPath);
} else if (process.env.VPS_SSH_PASSWORD) {
  cfg.password = process.env.VPS_SSH_PASSWORD;
  console.log("Dùng mật khẩu SSH (env VPS_SSH_PASSWORD)");
} else {
  console.error(
    "Cần VPS_SSH_PASSWORD hoặc key tại",
    keyPath,
    "\nHoặc: powershell -File scripts/setup-vps-ssh-key.ps1"
  );
  process.exit(1);
}

function alreadyListening() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(true));
    s.once("listening", () => {
      s.close(() => resolve(false));
    });
    s.listen(localPort, "127.0.0.1");
  });
}

async function main() {
  if (await alreadyListening()) {
    console.log(`Port ${localPort} đã mở — tunnel có thể đang chạy.`);
    process.exit(0);
  }

  const conn = new Client();
  conn
    .on("ready", () => {
      const server = net.createServer((socket) => {
        socket.on("error", () => {
          try {
            socket.destroy();
          } catch {
            /* ignore */
          }
        });
        conn.forwardOut(
          "127.0.0.1",
          0,
          remoteHost,
          remotePort,
          (err, stream) => {
            if (err) {
              socket.destroy();
              return;
            }
            stream.on("error", () => {
              try {
                socket.destroy();
              } catch {
                /* ignore */
              }
            });
            socket.pipe(stream);
            stream.pipe(socket);
          }
        );
      });
      server.listen(localPort, "127.0.0.1", () => {
        console.log(
          `OK tunnel: localhost:${localPort} -> ${host}:${remoteHost}:${remotePort}`
        );
      });
      server.on("error", (e) => {
        console.error("Listen error:", e.message);
        process.exit(1);
      });
    })
    .on("error", (e) => {
      console.error("SSH error:", e.message);
      process.exit(1);
    })
    .on("close", () => {
      console.error("SSH closed — restart tunnel nếu cần");
      process.exit(1);
    })
    .connect(cfg);
}

main();
