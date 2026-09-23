/**
 * Audit shop appearance on VPS — published vs draft vs live API.
 */
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
echo "=== PM2 / cwd ==="
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{for(const p of JSON.parse(d||"[]")){if(/aloha-shop/.test(p.name)) console.log(p.name,p.pm2_env.status,"cwd="+(p.pm2_env.pm_cwd||""),"NODE_ENV="+((p.pm2_env.env||{}).NODE_ENV||""),"SHOP_DB="+((p.pm2_env.env||{}).SHOP_STANDALONE_DB||(p.pm2_env.env||{}).SHOP_DATABASE_NAME||(p.pm2_env.env||{}).DATABASE_NAME||""))}})'

echo "=== git shop ==="
cd /root/aloha-shop && git log -3 --oneline && git status -sb | head -5

echo "=== appearance docs summary ==="
mongosh --quiet aloha_shop_db --eval '
const col=db.aloha_shop_appearance;
const n=col.countDocuments();
print("count="+n);
const docs=col.find({}).toArray();
for (const d of docs) {
  const pub = d.published || d;
  const draft = d.draft || null;
  const theme = (pub.theme || d.theme || {});
  const blocks = pub.blocks || d.blocks || [];
  const draftBlocks = draft && draft.blocks ? draft.blocks : [];
  const seo = (theme.seo || {});
  print("--- _id="+d._id);
  print("keys="+Object.keys(d).join(","));
  print("updatedAt="+(d.updatedAt||d.publishedAt||""));
  print("publishedAt="+(d.publishedAt||(pub&&pub.publishedAt)||""));
  print("version="+(d.version||pub.version||""));
  print("pubBlocks="+blocks.length+" draftBlocks="+draftBlocks.length);
  print("pubBlockTitles="+blocks.map(b=>(b.props&& (b.props.title||b.props.heading)) || b.type || "?").slice(0,12).join(" | "));
  if (draftBlocks.length) print("draftBlockTitles="+draftBlocks.map(b=>(b.props&& (b.props.title||b.props.heading)) || b.type || "?").slice(0,12).join(" | "));
  print("siteName="+(theme.siteName||""));
  print("seoTitleTpl="+(seo.productTitleTemplate||"").slice(0,80));
  print("hasPublishedField="+!!d.published+" hasDraftField="+!!d.draft+" hasThemeTop="+!!d.theme+" hasBlocksTop="+!!d.blocks);
}
'

echo "=== appearance history / backups if any ==="
mongosh --quiet aloha_shop_db --eval '
const names=db.getCollectionNames().filter(n=>/appear|backup|hist|revision/i.test(n));
print("cols="+names.join(","));
for (const n of names) {
  if (n==="aloha_shop_appearance") continue;
  const c=db.getCollection(n).countDocuments();
  print(n+"="+c);
  if (c>0 && c<50) {
    db.getCollection(n).find({}).sort({_id:-1}).limit(3).forEach(d=>{
      print("  sample "+n+" _id="+d._id+" at="+(d.updatedAt||d.createdAt||d.at||"")+" keys="+Object.keys(d).slice(0,12).join(","));
    });
  }
}
'

echo "=== live appearance API (local) ==="
curl -sS -m 20 -H "Cache-Control: no-cache" http://127.0.0.1:3001/api/shop/appearance | node -e '
let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{
  const j=JSON.parse(d);
  const blocks=j.blocks||[];
  console.log(JSON.stringify({
    version:j.version,
    publishedAt:j.publishedAt,
    siteName:j.theme&&j.theme.siteName,
    blockCount:blocks.length,
    titles:blocks.map(b=>(b.props&&(b.props.title||b.props.heading))||b.type).slice(0,15),
    seoTpl:(j.theme&&j.theme.seo&&j.theme.seo.productTitleTemplate||"").slice(0,80),
  },null,2));
});'

echo "=== public homepage html sniff ==="
curl -sS -m 20 -H "Cache-Control: no-cache" http://127.0.0.1:3002/ | node -e '
let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{
  const title=(d.match(/<title[^>]*>([^<]*)</i)||[])[1];
  const h1=(d.match(/<h1[^>]*>([^<]*)</i)||[])[1];
  const hasCombo=/Combo Đế Vương|Đế Vương/i.test(d);
  const blockish=[...d.matchAll(/Cây thành phẩm|Bán chạy|Khuyến mãi|Combo|Chậu|TÚI|Hero|banner/gi)].slice(0,20).map(m=>m[0]);
  console.log(JSON.stringify({title,h1,hasCombo,len:d.length,snips:blockish},null,2));
});'

echo "=== redis appearance keys ==="
redis-cli KEYS "*appear*" 2>/dev/null | head -30 || true
redis-cli KEYS "*shop*" 2>/dev/null | head -40 || true

echo "=== AUDIT_DONE ==="
`;

const conn = new Client();
conn
  .on("ready", () => {
    console.log("SSH OK");
    conn.exec(remoteCmd, { pty: true }, (e, stream) => {
      if (e) {
        console.error(e);
        conn.end();
        process.exit(1);
      }
      stream.on("data", (d) => process.stdout.write(d.toString()));
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      stream.on("close", (c) => {
        conn.end();
        process.exit(c || 0);
      });
    });
  })
  .on("error", (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({ host: "160.25.167.211", port: 22, username: "root", password, readyTimeout: 60000 });
