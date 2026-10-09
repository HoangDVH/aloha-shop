const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('frontend/components/catalog/useActiveFilters.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
test('retired stock selection creates neither a chip nor a filter count', () => {
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name === '@/lib/giftFilters') return { giftFilterLabel: v => v };
    if (name === 'react') return { useMemo: fn => fn() };
    if (name === '@/lib/api') return { formatVnd: v => String(v) };
    if (name === './catalogLayoutUtils') return { leafLabel: v => v };
    throw new Error(name);
  }});
  const result = exports.useActiveFilters({ categoryLocked: true, selectedNhoms: [], selectedAttrs: [], selectedDvts: [], minPrice: '', maxPrice: '', inStock: true, pushNhoms() {}, removeAttr() {}, removeDvt() {}, pushParams() {} });
  assert.equal(result.secondaryFilterCount, 0);
  assert.equal(result.activeFilters.length, 0);
});
