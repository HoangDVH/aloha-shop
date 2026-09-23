const path = require("path");
const { createRequire } = require("module");
function loadSsh2() {
  try {
    return createRequire(path.join(__dirname, "..", "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}
const { Client } = loadSsh2();
const password = process.env.VPS_PASSWORD || "aloha2026@";
const remoteCmd = `
set -e
echo "=== shop-api env DB ==="
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const p=JSON.parse(d).find(x=>x.name==="aloha-shop-api"); const e=(p&&p.pm2_env&&p.pm2_env.env)||{}; console.log(JSON.stringify({cwd:p.pm2_env.pm_cwd, DATABASE_NAME:e.DATABASE_NAME, SHOP_STANDALONE_DB:e.SHOP_STANDALONE_DB, SHOP_DATABASE_NAME:e.SHOP_DATABASE_NAME, OPS_DB:e.OPS_DATABASE_NAME||e.OPS_DB||e.KV_CONFIG_DB},null,2));})'

echo "=== .env keys (names only) ==="
grep -E '^(DATABASE_NAME|SHOP_|OPS_|MONGO)' /root/aloha-shop/.env 2>/dev/null | sed 's/=.*/=***/' || true

echo "=== users in DBs (no secrets) ==="
for DB in aloha_shop_db aloha_thumua aloha_thumua_playground; do
  mongosh --quiet "\$DB" --eval '
    const n=db.aloha_users.countDocuments();
    print("DB="+db.getName()+" users="+n);
    db.aloha_users.find({}, {username:1, role:1, active:1, fullName:1, approvalStatus:1, lockUntil:1, failedLoginCount:1}).limit(30).forEach(u=>{
      print("  "+u.username+" role="+u.role+" active="+u.active+" lock="+u.lockUntil+" fails="+u.failedLoginCount);
    });
    const hit=db.aloha_users.findOne({username:/nguyenvanb/i}, {username:1, role:1, active:1, lockUntil:1, failedLoginCount:1, passwordHash:1});
    if(hit) print("HIT nguyenvanb username="+hit.username+" role="+hit.role+" active="+hit.active+" hasHash="+!!hit.passwordHash+" hashLen="+(hit.passwordHash?String(hit.passwordHash).length:0));
    else print("HIT nguyenvanb=NONE");
  ' || echo "DB \$DB missing"
done

echo "=== login endpoint probe (wrong pw expected) ==="
curl -sS -m 10 -X POST http://127.0.0.1:3001/api/auth/login \\
  -H "Content-Type: application/json" -H "Origin: https://alohathegioichaucay.com" \\
  -d '{"username":"nguyenvanb@gmail.com","password":"definitely-wrong"}' | head -c 300; echo

echo DONE
`;
const conn = new Client();
conn.on("ready", () => {
  conn.exec(remoteCmd, { pty: true }, (e, stream) => {
    if (e) { console.error(e); conn.end(); process.exit(1); }
    stream.on("data", (d) => process.stdout.write(d.toString()));
    stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
    stream.on("close", (c) => { conn.end(); process.exit(c || 0); });
  });
}).on("error", (e) => { console.error(e); process.exit(1); })
.connect({ host: "160.25.167.211", port: 22, username: "root", password, readyTimeout: 60000 });
