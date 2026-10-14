const fs = require('node:fs');
const path = require('node:path');
const release = process.argv[2];
const processes = JSON.parse(fs.readFileSync(path.join(release, 'processes.json'), 'utf8'));
const api = processes.find(p => p.name === 'aloha-shop-api');
if (!api) throw new Error('Existing API process is required for a safe rollback');
function definition(p) {
  const e = p.pm2_env;
  return { name: p.name, cwd: e.pm_cwd, script: e.pm_exec_path, args: e.args,
    interpreter: e.exec_interpreter, env: e.env, autorestart: true, kill_timeout: 10000 };
}
const site = fs.readFileSync(process.env.NGINX_SITE || '/etc/nginx/sites-enabled/aloha-shop', 'utf8');
const port = site.match(/upstream\s+nextjs_shop_upstream\s*\{\s*server\s+127\.0\.0\.1:(3002|3003);/);
if (!port) throw new Error('Unrecognized active frontend upstream; refusing to switch');
const nextPort = port[1] === '3002' ? 3003 : 3002;
const slot = nextPort === 3003 ? 'aloha-shop-next' : 'aloha-shop';
const before = definition(api);
const nextApi = { ...before, cwd: release, script: path.join(release, 'node_modules/tsx/dist/cli.mjs'),
  args: ['backend/shop_standalone_server.ts'], env: { ...before.env, NODE_ENV: 'production', SHOP_SERVER_PORT: '3001' } };
const webEnv = processes.find(p => p.name === (nextPort === 3003 ? 'aloha-shop' : 'aloha-shop-next'))?.pm2_env.env || {};
const web = { name: slot, cwd: path.join(release, 'frontend'), script: path.join(release, 'frontend/node_modules/next/dist/bin/next'),
  args: ['start', '-H', '127.0.0.1', '-p', String(nextPort)], interpreter: 'node', autorestart: true,
  env: { ...webEnv, NODE_ENV: 'production', PORT: String(nextPort), NEXT_PUBLIC_RELEASE_ID: process.env.NEXT_PUBLIC_RELEASE_ID } };
for (const [file, app] of [['api.before.json', before], ['api.json', nextApi], ['web.json', web]]) {
  fs.writeFileSync(path.join(release, file), JSON.stringify({ apps: [app] }), { mode: 0o600 });
}
fs.writeFileSync(path.join(release, 'slot.env'), `PORT=${nextPort}\nSLOT=${slot}\n`);
