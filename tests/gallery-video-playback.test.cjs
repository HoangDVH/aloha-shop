const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('frontend/components/pdp/ProductGallery.tsx', 'utf8') + '\nexport { GalleryVideoSlide };', {
  compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX},
}).outputText;
function fixture(props = {}, play = () => Promise.resolve()) {
  const states = [], effects = [], exports = {};
  let i = 0, plays = 0, pauses = 0;
  const video = {paused: true, play() { plays++; return play(); }, pause() { pauses++; }};
  const jsx = (type, props) => ({type, props});
  vm.runInNewContext(code, {exports, require(name) {
    if (name === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (name === 'react') return {useRef: () => ({current: video}), useEffect: fn => effects.push(fn),
      useState(value) {const n = i++; states[n] = value; return [value, v => {states[n] = v;}];}};
    return {};
  }});
  const tree = exports.GalleryVideoSlide({src:'video.mp4', file:true, poster:'cover.jpg', alt:'Plant', isActive:true,
    isFirstSlide:true, mediaLightbox:false, slideIndex:0, onOpenLightbox() {}, ...props});
  function nodes(n) {return Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(n.props?.children)] : [];}
  return {states, video, nodes:nodes(tree), effect:effects[0], counts:() => ({plays, pauses})};
}
test('active video plays muted, loads the first slide and pauses on cleanup', async () => {
  const f = fixture();
  const video = f.nodes.find(n => n.type === 'video');
  assert.equal(video.props.muted, true);
  assert.equal(video.props.preload, 'auto');
  assert.equal(video.props.playsInline, true);
  const cleanup = f.effect(); await Promise.resolve();
  assert.equal(f.counts().plays, 1);
  cleanup(); assert.equal(f.counts().pauses, 1);
});
test('inactive slide or open lightbox pauses inline playback', () => {
  for (const props of [{isActive:false}, {mediaLightbox:true}]) {
    const f = fixture(props); f.effect();
    assert.equal(f.counts().plays, 0);
    assert.equal(f.counts().pauses, 1);
  }
});
test('play rejection ends loading and exposes manual playback state', async () => {
  const f = fixture({}, () => Promise.reject(Error('blocked')));
  f.effect(); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.states[1], false);
  assert.equal(f.states[2], true);
});
test('a late play rejection from a closed slide cannot change its state', async () => {
  let reject;
  const f = fixture({}, () => new Promise((_, r) => {reject = r;}));
  const cleanup = f.effect(); cleanup(); reject(Error('aborted'));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.states[2], false);
});
