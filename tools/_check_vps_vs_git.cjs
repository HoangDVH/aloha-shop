/**
 * So sánh code VPS với commit git local/origin.
 * Chạy từ máy local: node tools/_check_vps_vs_git.cjs
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function loadSsh2() {
  const { createRequire } = require("module");
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}

const { Client } = loadSsh2();
const localHead = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
const localMsg = execSync("git log -1 --oneline", { encoding: "utf8" }).trim();

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

const remoteCmd = `
set -e
cd /root/aloha-shop
echo LOCAL_COMPARE_TARGET=${localHead}
echo ===GIT===
if [ -d .git ]; then
  echo VPS_HEAD=$(git rev-parse HEAD 2>/dev/null || echo NONE)
  echo VPS_MSG=$(git log -1 --oneline 2>/dev/null || echo NONE)
  git fetch origin --quiet 2>/dev/null || true
  echo ORIGIN_MAIN=$(git rev-parse origin/main 2>/dev/null || echo NONE)
  echo AHEAD_BEHIND=$(git rev-list --left-right --count HEAD...origin/main 2>/dev/null || echo NA)
else
  echo VPS_HEAD=NO_GIT_DIR
fi
echo ===FILES===
for f in \
  backups/web-km-2026-09-15/README.md \
  tools/_unset_web_km_db.cjs \
  backend/shopOrders/ctvMeRoutes.ts \
  frontend/components/CtvEarningsPanel.tsx \
  backend/shopCatalog/webKm.ts \
  frontend/components/ProductPrice.tsx
do
  if [ -f "$f" ]; then echo PRESENT $f; else echo MISSING $f; fi
done
echo ===HASH_SNIP===
# so nhanh hash vài file source quan trọng
for f in backend/shopOrders/ctvMeRoutes.ts frontend/components/CtvEarningsPanel.tsx backend/shopOrders/bankConfig.ts; do
  if [ -f "$f" ]; then echo HASH $(sha256sum "$f" | awk '{print $1}') $f; else echo HASH MISSING $f; fi
done
echo ===DONE===
`;

const c = new Client();
c.on("ready", () => {
  console.log("LOCAL_HEAD", localHead);
  console.log("LOCAL_MSG", localMsg);
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
c.connect(cfg);
