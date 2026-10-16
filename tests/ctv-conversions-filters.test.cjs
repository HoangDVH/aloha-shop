const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const dayjs = require('../frontend/node_modules/dayjs');

function harness() {
  const slots = [];
  let cursor = 0, params, tree;
  const query = { data: [], isFetching: false };
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const code = ts.transpileModule(fs.readFileSync('frontend/components/ctv-portal/panels/ConversionsPanel.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'dayjs') return { default: dayjs };
    if (name === 'react') return {
      useMemo: fn => fn(),
      useState(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = initial;
        return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
      },
    };
    if (name === 'antd') return {
      Alert: 'Alert', Button: 'Button', Card: 'Card', Input: 'Input',
      Select: 'Select', Space: { Compact: 'Compact' }, Spin: 'Spin', Table: 'Table', Tag: 'Tag',
      DatePicker: { RangePicker: 'RangePicker' },
    };
    if (name.endsWith('/ctvPortalQueries')) return { useCtvMeConversions(p) { params = p; return query; } };
    if (name.endsWith('/ctvPortalUiStore')) return { useCtvPortalUiStore: () => ({ dateRange: {} }) };
    if (name.endsWith('/shared/format')) return { monthRange: () => ({ from: '2026-10-01', to: '2026-10-31' }) };
    if (name.endsWith('/visibleRefetchInterval')) return { visibleRefetchInterval: () => false };
    throw new Error(`Unexpected import: ${name}`);
  } });
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  }
  return {
    render() { cursor = 0; tree = exports.ConversionsPanel(); },
    find(type) { return nodes(tree).filter(n => n.type === type); },
    get params() { return params; }, query,
  };
}

test('date and status selections immediately update query filters and reset pagination', () => {
  const h = harness(); h.render();
  const changes = [
    ['Select', 0, 'hoan_thanh', 'orderStatus'],
    ['Select', 1, 'paid', 'paymentStatus'],
  ];
  for (const [type, index, value, key] of changes) {
    h.find('Table')[0].props.pagination.onChange(3); h.render();
    h.find(type)[index].props.onChange(type === 'Input' ? { target: { value } } : value);
    h.render();
    assert.equal(h.params[key], value, key);
    assert.equal(h.find('Table')[0].props.pagination.current, 1);
  }
  assert.equal(h.params.orderStatus, 'hoan_thanh');
  assert.equal(h.params.paymentStatus, 'paid');
  h.find('Table')[0].props.pagination.onChange(3); h.render();
  h.find('RangePicker')[0].props.onChange([dayjs('2026-09-01'), dayjs('2026-10-15')]); h.render();
  assert.equal(h.params.from, '2026-09-01');
  assert.equal(h.params.to, '2026-10-15');
  assert.equal(h.params.orderStatus, 'hoan_thanh');
  assert.equal(h.params.paymentStatus, 'paid');
  assert.equal(h.find('Table')[0].props.pagination.current, 1);
  h.find('RangePicker')[0].props.onChange(null); h.render();
  assert.equal(h.params.from, '2026-10-01');
  assert.equal(h.params.to, '2026-10-31');
});

test('order search waits for submit; reset clears all active filters', () => {
  const h = harness(); h.render();
  h.find('Select')[0].props.onChange('hoan_thanh'); h.render();
  h.find('Input')[0].props.onChange({ target: { value: 'HD001' } }); h.render();
  assert.equal(h.params.orderCode, '');
  h.find('Input')[0].props.onPressEnter(); h.render();
  assert.equal(h.params.orderCode, 'HD001');
  assert.equal(h.params.orderStatus, 'hoan_thanh');
  h.find('Button').find(n => n.props.children === 'Thiết lập lại').props.onClick(); h.render();
  assert.deepEqual(JSON.parse(JSON.stringify(h.params)), {
    from: '2026-10-01', to: '2026-10-31', orderCode: '', orderStatus: 'all', paymentStatus: 'all',
  });
  assert.equal(h.find('Input')[0].props.value, '');
});

test('report shows loading feedback while filters fetch new results', () => {
  const h = harness(); h.query.isFetching = true; h.render();
  assert.equal(h.find('Table')[0].props.loading, true);
});
