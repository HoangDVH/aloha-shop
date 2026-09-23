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
mongosh --quiet aloha_shop_db --eval '
const d=db.aloha_shop_appearance.findOne({_id:"storefront"});
print("allKeys="+Object.keys(d).join(","));
print("historyLen="+(d.history||[]).length);
print("hasPrev="+!!d.publishedPrevious);
print("publishedAt="+d.publishedAt);
print("updatedBy="+d.updatedBy);
'
curl -sS -m 15 https://alohathegioichaucay.com/api/shop/appearance | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d); const hero=(j.blocks||[]).find(b=>b.type==="hero"); console.log(JSON.stringify({version:j.version,publishedAt:j.publishedAt,titles:(j.blocks||[]).map(b=>((b.enabled===false)?"off:":"on:")+((b.props&&b.props.title)||b.type)), heroDefault:hero&&hero.props&&hero.props.useDefaultBanners, slideCount:((hero&&hero.props&&hero.props.slides)||[]).length},null,2));});'
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{for(const p of JSON.parse(d||"[]")){if(p.name==="aloha-shop") console.log("FINAL cwd="+p.pm2_env.pm_cwd)}})'
`;
const conn = new Client();
conn.on("ready", () => {
  conn.exec(remoteCmd, (e, stream) => {
    if (e) { console.error(e); conn.end(); process.exit(1); }
    stream.on("data", d => process.stdout.write(d.toString()));
    stream.stderr.on("data", d => process.stderr.write(d.toString()));
    stream.on("close", c => { conn.end(); process.exit(c||0); });
  });
}).on("error", e => { console.error(e); process.exit(1); })
.connect({ host: "160.25.167.211", port: 22, username: "root", password, readyTimeout: 60000 });
