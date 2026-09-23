/**
 * Fix SEO product templates hardcode "Combo Đế Vương" + verify TPEXH.
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
const conn = new Client();

const TITLE = "[Tên sản phẩm] | [Giá] · [Tên cửa hàng]";
const DESC = "[Tên sản phẩm] — Giá [Giá]. Mua tại [Tên cửa hàng].";

const remoteCmd = `
set -e
mongosh --quiet aloha_shop_db --eval '
const col = db.aloha_shop_appearance;
const before = col.findOne({}, { "theme.seo.productTitleTemplate": 1, "theme.seo.productDescriptionTemplate": 1, published: 1 });
print("BEFORE=" + JSON.stringify(before && before.theme && before.theme.seo));
const r = col.updateMany({}, {
  $set: {
    "theme.seo.productTitleTemplate": ${JSON.stringify(TITLE)},
    "theme.seo.productDescriptionTemplate": ${JSON.stringify(DESC)},
    "published.theme.seo.productTitleTemplate": ${JSON.stringify(TITLE)},
    "published.theme.seo.productDescriptionTemplate": ${JSON.stringify(DESC)},
    "draft.theme.seo.productTitleTemplate": ${JSON.stringify(TITLE)},
    "draft.theme.seo.productDescriptionTemplate": ${JSON.stringify(DESC)},
  }
});
print("UPDATED matched=" + r.matchedCount + " modified=" + r.modifiedCount);
const after = col.findOne({}, { "theme.seo.productTitleTemplate": 1, "theme.seo.productDescriptionTemplate": 1 });
print("AFTER=" + JSON.stringify(after && after.theme && after.theme.seo));
'
# clear redis shop cache if available
redis-cli KEYS '*shop*appearance*' 2>/dev/null | head -20 || true
pm2 restart aloha-shop-api --update-env || true
sleep 2
curl -sS -m 15 'https://alohathegioichaucay.com/api/shop/appearance' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d); const s=j.theme&&j.theme.seo||{}; console.log("LIVE_TPL", JSON.stringify({t:s.productTitleTemplate,d:(s.productDescriptionTemplate||"").slice(0,80)}));});'
echo SEO_FIX_DONE
`;

conn
  .on("ready", () => {
    console.log("SSH OK — fix SEO templates");
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
