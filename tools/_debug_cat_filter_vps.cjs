/**
 * Debug category filter on VPS (ports + SSR-like fetch).
 * Requires: VPS_PASSWORD
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
echo "=== pm2 ==="
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{for (const p of JSON.parse(d)) { const e=p.pm2_env||{}; console.log(p.name, e.status, "PORT="+(e.PORT||(e.env&&e.env.PORT)||""), "SHOP_API_INTERNAL="+(e.SHOP_API_INTERNAL||(e.env&&e.env.SHOP_API_INTERNAL)||"")); }})'
node <<'NODE'
async function hit(port, qs) {
  const url = "http://127.0.0.1:" + port + "/api/shop/products?limit=1&sort=ten" + (qs || "");
  const res = await fetch(url);
  const t = await res.text();
  try {
    const j = JSON.parse(t);
    console.log("port", port, qs || "(none)", "status", res.status, "total", j.total);
  } catch {
    console.log("port", port, qs || "(none)", "status", res.status, "body", t.slice(0, 120));
  }
}
async function tree(port) {
  const res = await fetch("http://127.0.0.1:" + port + "/api/shop/category-tree");
  const t = await res.text();
  try {
    const j = JSON.parse(t);
    const walk = (nodes, slug) => {
      for (const n of nodes || []) {
        if (n.slug === slug) return n;
        const h = walk(n.subs, slug);
        if (h) return h;
      }
      return null;
    };
    const n = walk(j.items, "cay-phong-thuy");
    console.log("tree", port, n ? { id: n.id, name: n.name, path: n.path, count: n.count } : null);
  } catch {
    console.log("tree", port, "FAIL", t.slice(0, 120));
  }
}
(async () => {
  await tree(3000);
  await tree(3001);
  await hit(3000, "");
  await hit(3000, "&categoryId=1000307882");
  await hit(3001, "");
  await hit(3001, "&categoryId=1000307882");
})();
NODE
`;
const c = new Client();
c.on("ready", () => {
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
