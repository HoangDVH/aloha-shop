const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const { plan } = require('../scripts/test-quick.cjs');
const { campaignFixture } = require('./browser-qa/campaign-fixture.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('local checks require a scope, deduplicate files, reject typos and support dry-run', () => {
  assert.equal(plan([]), null);
  assert.equal(plan(['--help']), null);
  assert.throws(() => plan(['voucher']), /Unknown test group/);
  assert.deepEqual(plan(['sharing', '--dry-run']), plan(['sharing']));
  assert.equal(new Set(plan(['sharing', 'release'])).size, plan(['sharing', 'release']).length);
  for (const file of plan(['release'])) assert.ok(fs.existsSync(path.join(root, file)), file);
  for (const file of ['share-caption', 'promotions-evaluator', 'voucher-wallet', 'pdp-vouchers']) {
    assert.ok(plan(['release']).includes(`tests/${file}.test.ts`));
  }
});

test('deploy still waits for both validation jobs and preserves safe deployment sequencing', () => {
  const workflow = YAML.parse(read('.github/workflows/deploy.yml'));
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(workflow.jobs.checks.strategy.matrix.check, ['api', 'web']);
  assert.equal(workflow.jobs.deploy.needs, 'checks');
  assert.equal(workflow.jobs['browser-smoke'].needs, 'deploy');
  const steps = workflow.jobs.checks.steps;
  assert.ok(steps.some(s => s.run === 'npm run test:release'));
  assert.ok(steps.some(s => s.run?.includes('release-rollback.test.py')));
  assert.ok(steps.some(s => s.run?.includes('bash -n scripts/deploy-production.sh')));
});

test('full browsers run by schedule/manual only; smoke and full jobs install just their own browser', () => {
  const full = YAML.parse(read('.github/workflows/browser-full.yml'));
  assert.equal(full.on.schedule[0].cron, '0 20 * * *');
  assert.ok(Object.hasOwn(full.on, 'workflow_dispatch'));
  assert.ok(!full.on.push);
  for (const job of [full.jobs.browser, YAML.parse(read('.github/workflows/deploy.yml')).jobs['browser-smoke']]) {
    assert.deepEqual(job.strategy.matrix.include.map(p => p.project), ['chromium', 'webkit-mobile']);
    assert.ok(job.steps.some(s => s.run?.includes('${{ matrix.browser }}')));
    assert.ok(job.steps.some(s => s.run?.includes('--project=${{ matrix.project }}')));
    assert.ok(job.steps.some(s => s.with?.['cache-dependency-path'] === 'tests/browser-qa/package-lock.json'));
  }
  const scripts = JSON.parse(read('tests/browser-qa/package.json')).scripts;
  assert.ok(scripts.test.includes('test:smoke') && scripts.test.includes('--project=chromium'));
  assert.ok(scripts['test:smoke'].includes('--global-timeout=180000'));
  assert.ok(scripts['test:full'].includes('--global-timeout=480000'));
});

test('voucher audience fixtures do not require an active production campaign', () => {
  for (const newBuyer of [true, false]) {
    const fixture = campaignFixture(newBuyer, Date.parse('2026-12-01T00:00:00Z'));
    assert.equal(fixture.viewer.newBuyer, newBuyer);
    assert.equal(fixture.campaign.phase, 'live');
    assert.ok(Date.parse(fixture.campaign.endAt) > fixture.serverNow);
    assert.deepEqual(fixture.vouchers.map(v => v.targetCustomer), ['new_web', 'returning_web']);
  }
});
