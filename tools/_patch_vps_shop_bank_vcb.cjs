/**
 * Patch shop bank env on VPS → VCB 9931101233 (KV accountId 20069), restart API.
 */
const { createRequire } = require("module");
const { pathToFileURL } = require("url");
const path = require("path");
function loadSsh2() {
  const candidates = [
    path.join(__dirname, "..", "node_modules", "ssh2"),
    "C:/Users/dauvu/ALOHA-GARDEN-2/node_modules/ssh2",
  ];
  for (const p of candidates) {
    try {
      return createRequire(__filename)(p);
    } catch {
      /* try next */
    }
  }
  return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
}
const { Client } = loadSsh2();
void pathToFileURL;

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

const remoteScript = `
set -e
ENV_FILE=""
for f in /root/aloha-shop/.env /root/aloha_thumua_webapp/.env; do
  if [ -f "$f" ] && grep -qE '^SHOP_KV_ACCOUNT_ID=' "$f" 2>/dev/null; then
    ENV_FILE="$f"
    break
  fi
done
if [ -z "$ENV_FILE" ]; then
  echo "ERR: no shop env with SHOP_KV_ACCOUNT_ID"
  ls -la /root/aloha-shop/.env /root/aloha_thumua_webapp/.env 2>/dev/null || true
  exit 1
fi
echo "ENV_FILE=$ENV_FILE"
cp -a "$ENV_FILE" "\${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
python3 - <<'PY'
from pathlib import Path
import os
path = os.environ.get("ENV_FILE")
# ENV_FILE passed via shell below
PY
ENV_FILE="$ENV_FILE" python3 - <<'PY'
from pathlib import Path
import os, re
path = Path(os.environ["ENV_FILE"])
text = path.read_text(encoding="utf-8")
repl = {
  "SHOP_BANK_BIN": "970436",
  "SHOP_BANK_ACCOUNT": "9931101233",
  "SHOP_KV_ACCOUNT_ID": "20069",
  "SHOP_BANK_ACCOUNT_NAME": "NGUYEN VAN XUAN",
  "SHOP_BANK_NAME": "Vietcombank",
}
for k, v in repl.items():
  pat = re.compile(rf"^{re.escape(k)}=.*$", re.M)
  line = f"{k}={v}"
  if pat.search(text):
    text = pat.sub(line, text)
  else:
    text = text.rstrip() + "\\n" + line + "\\n"
path.write_text(text, encoding="utf-8")
print("patched keys:")
for k in repl:
  for line in path.read_text(encoding="utf-8").splitlines():
    if line.startswith(k + "="):
      print(line)
      break
PY
echo "=== restart api ==="
pm2 restart aloha-shop-api --update-env || pm2 restart aloha-shop --update-env || true
pm2 ls | head -40
`;

const c = new Client();
c.on("ready", () => {
  c.exec(remoteScript, (err, stream) => {
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
