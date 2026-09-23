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
mongosh --quiet aloha_shop_db --eval '
const d=db.aloha_shop_appearance.findOne({_id:"storefront"});
const b=(d.published.blocks||[]).find(x=>String((x.props&&x.props.title)||"").includes("BÌNH") || String((x.props&&x.props.title)||"").includes("BINH"));
printjson(b);
'

echo "=== try product APIs for that block ==="
# dump block props via node from appearance API
curl -sS http://127.0.0.1:3001/api/shop/appearance | node <<'NODE'
let d="";
process.stdin.on("data",c=>d+=c);
process.stdin.on("end", async ()=>{
  const j=JSON.parse(d);
  const b=(j.blocks||[]).find(x=>String(x.props?.title||"").includes("BÌNH") || String(x.props?.title||"").toUpperCase().includes("BINH"));
  console.log("block", JSON.stringify(b,null,2));
  if(!b) return;
  const p=b.props||{};
  const qs=new URLSearchParams();
  if(p.categoryId) qs.set("categoryId", String(p.categoryId));
  if(p.nhomPath) qs.set("nhom", String(p.nhomPath));
  if(p.nhom) qs.set("nhom", String(p.nhom));
  if(p.categoryName) qs.set("nhom", String(p.categoryName));
  qs.set("limit", String(p.limit||15));
  qs.set("sort", String(p.sort||"ban_chay"));
  const url="http://127.0.0.1:3001/api/shop/products?"+qs.toString();
  console.log("try", url);
  const r=await fetch(url);
  const pj=await r.json();
  console.log("count", (pj.items||pj.data||[]).length, "total", pj.total, "err", pj.error);
  console.log("sample", (pj.items||[]).slice(0,3).map(i=>({ma:i.ma,ten:i.ten,nhom:i.nhom})));
});
NODE

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
}).on("error", e => { console.error(e); process.exit(1); })
.connect({ host: "160.25.167.211", port: 22, username: "root", password, readyTimeout: 60000 });
