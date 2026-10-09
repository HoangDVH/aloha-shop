const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props: props || {} });
const code = ts.transpileModule(fs.readFileSync('frontend/components/ArticleVideoPlayer.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function fixture() {
  const effects = [], refs = [], updates = [], exports = {};
  const document = { fullscreenElement: null, addEventListener() {}, removeEventListener() {}, async exitFullscreen() { this.fullscreenElement = null; } };
  vm.runInNewContext(code, { exports, document, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'lucide-react') return { Expand: 'expand', Minimize: 'minimize' };
    if (name === 'react') return { useRef: () => { const ref = { current: null }; refs.push(ref); return ref; }, useState: () => [false, v => updates.push(v)], useEffect: fn => effects.push(fn) };
    throw new Error(name);
  }});
  const tree = exports.ArticleVideoPlayer({ src: '/uploads/test.mp4', title: 'Test' });
  return { tree, refs, effects, document, updates };
}
test('one video stream supplies controls and canvas is decorative', () => {
  const f = fixture();
  const children = f.tree.props.children.filter(Boolean);
  assert.equal(children.filter(n => n.type === 'video').length, 1);
  const video = children.find(n => n.type === 'video');
  assert.equal(video.props.controls, true);
  assert.equal(video.props.playsInline, true);
  assert.equal(children.find(n => n.type === 'canvas').props['aria-hidden'], 'true');
});
test('fullscreen opens the entire frame and exits without restarting video', async () => {
  const f = fixture();
  const frame = { async requestFullscreen() { f.document.fullscreenElement = frame; } };
  f.refs[0].current = frame;
  const button = f.tree.props.children.find(n => n?.type === 'button');
  await button.props.onClick();
  assert.equal(f.document.fullscreenElement, frame);
  await button.props.onClick();
  assert.equal(f.document.fullscreenElement, null);
});
test('ambient frame fills its canvas and releases event listeners', () => {
  const f = fixture(), listeners = new Map(), calls = [];
  f.refs[1].current = { readyState: 2, videoWidth: 1080, videoHeight: 1920,
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  f.refs[2].current = { width: 320, height: 180, getContext: () => ({ drawImage: (...args) => calls.push(args) }) };
  const cleanup = f.effects[0]();
  assert.equal(listeners.size, 3);
  assert.equal(calls[0][3], 320);
  assert.ok(calls[0][4] >= 180);
  cleanup();
  assert.equal(listeners.size, 0);
});
