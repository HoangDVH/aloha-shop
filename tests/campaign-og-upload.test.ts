import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { renderCampaignOgImage } from "../backend/shopCampaigns/routes/ogImage.js";
import { processAppearanceUploadBuffer } from "../backend/shopAppearance/register.js";

async function makeSolidPng(width: number, height: number, r = 210, g = 45, b = 45): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r, g, b },
    },
  })
    .png()
    .toBuffer();
}

test("renderCampaignOgImage: 1600x840 share banner -> 1200x630 Baseline JPEG 4:2:0 gon nhe", async () => {
  const input = await makeSolidPng(1600, 840, 240, 220, 190);
  const out = await renderCampaignOgImage(input, { isCustomShare: true });
  const meta = await sharp(out).metadata();

  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
  assert.equal(meta.isProgressive, false);
  assert.equal(meta.chromaSubsampling, "4:2:0");
  assert.ok(out.length < 450_000, `Expected compact JPEG (<450KB), got ${out.length} bytes`);
});

test("renderCampaignOgImage: 1600x600 banner dai -> mac dinh 1200x630 Baseline JPEG tran vien (cover) net toan man hinh", async () => {
  const input = await makeSolidPng(1600, 600, 45, 90, 40);
  const out = await renderCampaignOgImage(input, { isCustomShare: false });
  const meta = await sharp(out).metadata();

  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
  assert.equal(meta.isProgressive, false);
});

test("renderCampaignOgImage: 1600x600 banner dai -> fit=blur van ho tro nen mo hai vien khi co yeu cau", async () => {
  const input = await makeSolidPng(1600, 600, 45, 90, 40);
  const out = await renderCampaignOgImage(input, { isCustomShare: false, fit: "blur" });
  const meta = await sharp(out).metadata();

  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
  assert.equal(meta.isProgressive, false);
});

test("processAppearanceUploadBuffer: kind=share giu PNG lossless neu duoi nguong", async () => {
  const input = await makeSolidPng(1200, 630, 180, 30, 30);
  const res = await processAppearanceUploadBuffer(input, "share");
  const meta = await sharp(res.out).metadata();

  assert.equal(res.ext, "png");
  assert.equal(res.prefix, "share");
  assert.equal(meta.format, "png");
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
});

test("processAppearanceUploadBuffer: kind=share vuot nguong PNG fallback sang Baseline JPEG q94", async () => {
  const input = await makeSolidPng(1200, 630, 180, 30, 30);
  const res = await processAppearanceUploadBuffer(input, "share", 100);
  const meta = await sharp(res.out).metadata();

  assert.equal(res.ext, "jpg");
  assert.equal(res.prefix, "share");
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.isProgressive, false);
});

test("processAppearanceUploadBuffer: kind=banner va kind=favicon van xuat WebP toi uu", async () => {
  const input = await makeSolidPng(1200, 600, 30, 120, 60);

  const banner = await processAppearanceUploadBuffer(input, "banner");
  const bannerMeta = await sharp(banner.out).metadata();
  assert.equal(banner.ext, "webp");
  assert.equal(banner.prefix, "banner");
  assert.equal(bannerMeta.format, "webp");

  const favicon = await processAppearanceUploadBuffer(input, "favicon");
  const faviconMeta = await sharp(favicon.out).metadata();
  assert.equal(favicon.ext, "webp");
  assert.equal(favicon.prefix, "favicon");
  assert.equal(faviconMeta.format, "webp");
  assert.equal(faviconMeta.width, 256);
  assert.equal(faviconMeta.height, 256);
});
