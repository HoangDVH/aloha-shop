import test from 'node:test';
import assert from 'node:assert/strict';
import { articleVideoUrlSchema, normalizeArticleVideoUrl, sanitizeArticleHtml } from '../backend/shopArticles/sanitize.js';
import { normalizeVideoInput } from '../frontend/components/admin/website/articles/articleMediaUtils.js';

const video = 'https://pub-47761e6b4231489580175c7b8a2d0490.r2.dev/san-pham/BANNER/video_MP4_H264_Windows%20(1).mp4';

test('R2 video with parentheses survives both form and API normalization', () => {
  assert.deepEqual(normalizeVideoInput(video), { kind: 'file', url: video });
  assert.equal(normalizeArticleVideoUrl(video), video);
  assert.equal(articleVideoUrlSchema.parse(video), video);
  assert.equal(articleVideoUrlSchema.parse(articleVideoUrlSchema.parse(video)), video);
});

test('inline article videos preserve the same supported filename', () => {
  assert.ok(sanitizeArticleHtml(`<p>Video</p><video src="${video}" controls></video>`).includes(video));
});

test('invalid video inputs fail validation instead of becoming empty on save', () => {
  for (const input of ['javascript:alert(1)', 'https://example.com/not-a-video', 42, video + '" onerror="alert(1)']) {
    assert.equal(articleVideoUrlSchema.safeParse(input).success, false);
  }
  assert.equal(articleVideoUrlSchema.parse(''), '');
  assert.equal(articleVideoUrlSchema.parse('   '), '');
});

test('existing upload, YouTube, and Drive formats remain supported', () => {
  assert.equal(articleVideoUrlSchema.parse('/uploads/shop-articles/video.mp4'), '/uploads/shop-articles/video.mp4');
  assert.equal(articleVideoUrlSchema.parse('https://youtu.be/abcdefghijk'), 'https://www.youtube.com/embed/abcdefghijk');
  assert.equal(articleVideoUrlSchema.parse('https://drive.google.com/file/d/video123/view'), 'https://drive.google.com/file/d/video123/preview');
});
