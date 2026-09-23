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
echo "=== OPS_DB_NAME value ==="
grep -E '^(OPS_DB_NAME|MONGO_URI_OPS|SHOP_STANDALONE_DB)=' /root/aloha-shop/.env | sed 's/\\(URI[^=]*\\)=.*/\\1=***/'

echo "=== search nguyenvanb across DBs ==="
mongosh --quiet --eval '
const dbs=["aloha_shop_db","aloha_thumua","aloha_thumua_playground"];
for (const name of dbs) {
  const dbx=db.getSiblingDB(name);
  const cols=dbx.getCollectionNames();
  for (const c of cols) {
    try {
      const n=dbx[c].countDocuments({$or:[
        {username:/nguyenvanb/i},
        {email:/nguyenvanb/i},
        {fullName:/nguyen van b/i},
        {ten:/nguyen van b/i}
      ]});
      if(n>0){
        print(name+"."+c+" hits="+n);
        dbx[c].find({$or:[{username:/nguyenvanb/i},{email:/nguyenvanb/i}]} , {username:1,email:1,role:1,active:1,fullName:1,provider:1}).limit(5).forEach(d=>printjson({col:c, username:d.username, email:d.email, role:d.role, active:d.active, fullName:d.fullName, provider:d.provider}));
      }
    } catch(e) {}
  }
}
'

echo "=== all staff usernames ==="
for DB in aloha_shop_db aloha_thumua; do
  mongosh --quiet \$DB --eval 'db.aloha_users.find({},{username:1,role:1,active:1,fullName:1}).forEach(u=>print(db.getName()+": "+u.username+" | "+u.role+" | "+u.fullName+" | active="+u.active))'
done

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
