const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sharp = require('sharp');
const source = fs.readFileSync('frontend/lib/navIllustrations.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleExports = {};
new Function('exports', compiled)(moduleExports);

test('every curated menu image is a valid local inventory photo with recorded source', async () => {
  const manifest = JSON.parse(fs.readFileSync('frontend/public/nav-real-plants/sources.json', 'utf8'));
  const files = [...new Set([...source.matchAll(/"(\/nav-real-plants\/[^"\n]+)"/g)].map(m => m[1]))];
  assert.equal(files.length, 24);
  for (const file of files) {
    assert.ok(manifest.some(p => '/nav-real-plants/' + p.file === file && p.ma && p.url.startsWith('https://')));
    const metadata = await sharp(path.join('frontend/public', file)).metadata();
    assert.ok(metadata.width >= 200 && metadata.height >= 200, file);
  }
});
test('distinct plant species and Vietnamese Đ map to the correct audited photos', () => {
  const { navIllustrationSrc } = moduleExports;
  assert.notEqual(navIllustrationSrc('Cây Kim Ngân'), navIllustrationSrc('Cây Kim Ngân Lượng'));
  assert.equal(navIllustrationSrc('Cây Đuôi Công'), '/nav-real-plants/duoi-cong.jpg');
  assert.equal(navIllustrationSrc('Đế Vương Kim Cương'), '/nav-real-plants/de-vuong.jpg');
  assert.equal(navIllustrationSrc('Cây Bình An'), '/nav-real-plants/binh-an.jpg');
});
