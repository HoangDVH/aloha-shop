require('dotenv').config({ quiet: true });
const { spawnSync } = require('node:child_process');
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required for isolated Mongo fixtures');
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'tests/shop-top-products.test.ts', 'tests/shop-visits.test.ts',
  'tests/top-products-ui.test.ts', 'tests/product-view-tracker.test.ts', 'tests/returned-product-analytics.test.ts'], {
  stdio: 'inherit', env: { ...process.env, SHOP_ANALYTICS_TEST_MONGO_URI: process.env.MONGO_URI,
    SHOP_VISITS_TEST_MONGO_URI: process.env.MONGO_URI, CACHE_REDIS_URL: '', SHOP_PUBLIC_CACHE_ENABLED: '0' },
});
process.exitCode = result.status ?? 1;
