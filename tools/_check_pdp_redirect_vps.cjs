const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
function loadSsh2() {
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("ssh2");
  } catch {
    return createRequire("C:/Users/dauvu/ALOHA-GARDEN-2/package.json")("ssh2");
  }
}
const { Client } = loadSsh2();
const key = fs.readFileSync(
  path.join(process.env.USERPROFILE || "", ".ssh", "id_ed25519_aloha_gha_deploy")
);
const remoteCmd = `
set -e
curl -sI 'http://127.0.0.1:3002/c/thiet-bi-vat-dung/p/tui-nuoc-mia-2-ly--tnm2l' | head -25
echo '---MAP---'
curl -s 'http://127.0.0.1:3001/api/shop/redirects/map' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d); const map=j.map||j; const hits=Object.entries(map).filter(([k,v])=>/TNM2L|tui-nuoc-mia|SP=/i.test(k+String(v))); console.log(JSON.stringify(hits.slice(0,30),null,2)); console.log("mapSize",Object.keys(map).length);}catch(e){console.log(d.slice(0,800));}})'
echo '---NGINX---'
grep -Rni 'SP=' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | head -15 || true
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
c.connect({
  host: "160.25.167.211",
  username: "root",
  privateKey: key,
});
