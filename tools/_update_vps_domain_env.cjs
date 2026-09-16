/**
 * Cập nhật SHOP_PUBLIC_URL + NEXT_PUBLIC_SHOP_ORIGIN trên VPS .env
 * sang https://alohathegioichaucay.com (giữ key khác nguyên).
 */
const path = require("path");

function loadSsh2() {
  const { createRequire } = require("module");
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}

const { Client } = loadSsh2();
const cfg = {
  host: process.env.VPS_HOST || "160.25.167.211",
  port: 22,
  username: "root",
  password: process.env.VPS_PASSWORD || process.env.VPS_SSH_PASSWORD || "",
};
if (!cfg.password) {
  console.error("Set VPS_PASSWORD");
  process.exit(1);
}

const remote = `
set -e
cd /root/aloha-shop
ENVF=.env
test -f "$ENVF" || ENVF=backend/.env
test -f "$ENVF"
cp -a "$ENVF" "\${ENVF}.bak-domain-\$(date +%Y%m%d%H%M%S)"
python3 - <<'PY'
from pathlib import Path
import re, os
p = Path(os.environ.get("ENVF",".env"))
# find actual file
for cand in [Path(".env"), Path("backend/.env")]:
    if cand.exists():
        p = cand
        break
text = p.read_text(encoding="utf-8")
replacements = {
    "SHOP_PUBLIC_URL": "https://alohathegioichaucay.com",
    "NEXT_PUBLIC_SHOP_ORIGIN": "https://alohathegioichaucay.com",
    "NEXT_PUBLIC_SITE_URL": "https://alohathegioichaucay.com",
    "GOOGLE_REDIRECT_URI": "https://alohathegioichaucay.com/api/shop/auth/google/callback",
}
lines = text.splitlines(True)
out = []
seen = set()
for line in lines:
    m = re.match(r"^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=", line)
    if m and m.group(1) in replacements:
        k = m.group(1)
        out.append(f"{k}={replacements[k]}\\n")
        seen.add(k)
    else:
        out.append(line)
for k,v in replacements.items():
    if k not in seen and k in ("SHOP_PUBLIC_URL","NEXT_PUBLIC_SHOP_ORIGIN"):
        out.append(f"{k}={v}\\n")
p.write_text("".join(out), encoding="utf-8")
print("updated", p)
for k in replacements:
    print(k, replacements[k] if k in seen or k in ("SHOP_PUBLIC_URL","NEXT_PUBLIC_SHOP_ORIGIN") else "skipped_missing")
PY
# show relevant keys only (no secrets dump)
grep -E '^(SHOP_PUBLIC_URL|NEXT_PUBLIC_SHOP_ORIGIN|NEXT_PUBLIC_SITE_URL|GOOGLE_REDIRECT_URI)=' .env backend/.env 2>/dev/null || true
echo ENV_DOMAIN_OK
`;

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
