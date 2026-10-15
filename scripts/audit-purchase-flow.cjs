const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const mongoOnly = process.argv.includes('--mongo');
const withMongo = mongoOnly || process.argv.includes('--with-mongo');
if (withMongo) process.env.TEST_MONGO_URI = 'mongodb://127.0.0.1:27019';
const destination = path.join(root, 'artifacts', 'purchase-flow-audit', ...(mongoOnly ? ['mongo'] : withMongo ? ['final'] : []));
fs.mkdirSync(destination, { recursive: true });
const scopes = /^(account-|admin-ctv|admin-website|address-|anti-abuse|campaign-|cart-|catalog-(price-order|discount-filter|gift-filter)|checkout-|commission-|compact-pricing|customer-(directory|review-target)|deal-product|flash-slot|gift-|home-wholesale|kv-|mobile-(purchase|variant)|order-(shipping|volume)|pdp-|pending-price|promotion|returning-voucher|ship|shop(Gifts|Inquiries)|shop-session|si-|stock-hold|three-page|tinh-|void-test|volume-|voucher-|wholesale-)/;
const files = fs.readdirSync(path.join(root, 'tests')).filter(name => /\.test\.(ts|cjs)$/.test(name) && scopes.test(name))
  .filter(name => !mongoOnly || /TEST_MONGO_SKIP|openTestDb/.test(fs.readFileSync(path.join(root, 'tests', name), 'utf8'))).sort();
const manifest = { createdAt: new Date().toISOString(), files, testMongoConfigured: Boolean(process.env.TEST_MONGO_URI),
  mode: 'Local automated tests; real external order creation is not part of this runner.' };
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Purchase-flow audit: ${files.length} files; Mongo integration configured: ${manifest.testMongoConfigured}`);
const child = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=2', '--test-timeout=30000',
  '--test-reporter=tap', `--test-reporter-destination=${path.join(destination, 'tests.tap')}`,
  '--test-reporter=junit', `--test-reporter-destination=${path.join(destination, 'tests.xml')}`,
  ...files.map(name => `tests/${name}`)], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  console.log(`Purchase-flow audit completed: exit=${code}, signal=${signal || 'none'}`);
  process.exitCode = signal ? 1 : code ?? 1;
});
