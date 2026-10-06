import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTrustProps, DEFAULT_TRUST_PROPS } from "../backend/shopAppearance/trust.js";
import { buildDefaultAppearanceLayout } from "../backend/shopAppearance/seed.js";

test("normalizeTrustProps fallback to default on invalid or empty input", () => {
  const emptyRes = normalizeTrustProps(null);
  assert.equal(emptyRes.title, DEFAULT_TRUST_PROPS.title);
  assert.equal(emptyRes.clients.length, DEFAULT_TRUST_PROPS.clients.length);
  assert.equal(emptyRes.services.length, DEFAULT_TRUST_PROPS.services.length);
  assert.equal(emptyRes.gallery.length, DEFAULT_TRUST_PROPS.gallery.length);
});

test("normalizeTrustProps filters invalid images and malicious URLs", () => {
  const maliciousInput = {
    title: "Tiêu đề test",
    clients: [
      {
        id: "c1",
        title: "Khách 1",
        imageUrl: "javascript:alert(1)", // Độc hại -> loại bỏ
      },
      {
        id: "c2",
        title: "Khách 2",
        imageUrl: "/banners/trust/don-bidv.webp", // Hợp lệ -> giữ
      },
      {
        id: "c3",
        title: "", // Thiếu title -> loại bỏ
        imageUrl: "/banners/trust/don-phan-vu.webp",
      },
    ],
    marketplaces: [
      {
        id: "m1",
        platform: "shopee",
        label: "Shopee Mall",
        url: "http://insecure-shopee.vn", // Không phải https -> loại bỏ
      },
      {
        id: "m2",
        platform: "tiktok",
        label: "TikTok Shop",
        url: "https://tiktok.com/@aloha", // Hợp lệ
      },
    ],
    cta: {
      label: "Nhận báo giá",
      href: "javascript:void(0)", // Độc hại -> rơi về mặc định
    },
  };

  const res = normalizeTrustProps(maliciousInput);
  assert.equal(res.title, "Tiêu đề test");
  assert.equal(res.clients.length, 1);
  assert.equal(res.clients[0].id, "c2");
  assert.equal(res.clients[0].title, "Khách 2");

  assert.equal(res.marketplaces.length, 1);
  assert.equal(res.marketplaces[0].id, "m2");
  assert.equal(res.marketplaces[0].platform, "tiktok");

  assert.equal(res.cta?.href, DEFAULT_TRUST_PROPS.cta?.href);
});

test("normalizeTrustProps limits max array lengths", () => {
  const manyClients = Array.from({ length: 25 }, (_, i) => ({
    id: `c_${i}`,
    title: `Client ${i}`,
    imageUrl: `/banners/trust/don-bidv.webp`,
  }));

  const res = normalizeTrustProps({ clients: manyClients });
  assert.equal(res.clients.length, 12, "Giới hạn tối đa 12 đối tác/đơn hàng");
});

test("buildDefaultAppearanceLayout includes trust_section right before article_section", () => {
  const layout = buildDefaultAppearanceLayout();
  const trustIdx = layout.blocks.findIndex((b) => b.type === "trust_section");
  const articleIdx = layout.blocks.findIndex((b) => b.type === "article_section");

  assert.ok(trustIdx >= 0, "Phải có khối trust_section");
  assert.ok(articleIdx >= 0, "Phải có khối article_section");
  assert.equal(trustIdx + 1, articleIdx, "trust_section phải đứng liền trước article_section");

  const trustBlock = layout.blocks[trustIdx];
  assert.equal(trustBlock.enabled, true);
  assert.ok(trustBlock.props);
});
