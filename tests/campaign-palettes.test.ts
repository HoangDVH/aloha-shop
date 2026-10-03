import test from "node:test";
import assert from "node:assert/strict";
import { CAMPAIGN_PALETTES, matchPalette } from "../frontend/lib/campaign/campaignPalettes.js";
import { FLASH_STAGE_BG } from "../frontend/lib/campaign/flashSlots.js";
import { PRESET_COLORS, buildPresetContent, listPresets } from "../backend/shopCampaigns/presets.js";

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

test("palette: màu chính và màu nhấn đọc được chữ trắng (WCAG AA ≥ 4.5)", () => {
  for (const p of CAMPAIGN_PALETTES) {
    for (const k of ["primary", "accent"] as const) {
      const ratio = contrastWithWhite(p.colors[k]);
      assert.ok(ratio >= 4.5, `${p.key}.${k} ${p.colors[k]} chỉ ${ratio.toFixed(2)}:1`);
    }
    assert.ok(luminance(p.colors.cream) > 0.85, `${p.key}.cream ${p.colors.cream} phải là nền sáng`);
  }
});

test("dải Flash Sale: một tông đỏ, mọi điểm màu đọc được chữ trắng", () => {
  const stops = FLASH_STAGE_BG.match(/#[0-9A-Fa-f]{6}/g) || [];
  assert.ok(stops.length >= 2);
  for (const hex of stops) {
    assert.ok(contrastWithWhite(hex) >= 4.5, `${hex} chỉ ${contrastWithWhite(hex).toFixed(2)}:1`);
    const n = parseInt(hex.slice(1), 16);
    assert.ok(((n >> 16) & 255) > 2 * ((n >> 8) & 255), `${hex} không phải tông đỏ`);
  }
});

test("palette: màu preset backend có trong bảng màu admin", () => {
  for (const [name, colors] of Object.entries(PRESET_COLORS)) {
    assert.ok(matchPalette(colors), `PRESET_COLORS.${name} không khớp bảng màu nào ở admin`);
  }
});

test("preset: mỗi mẫu tạo chiến dịch với màu trong bảng màu và có đủ dịp ngày đôi", () => {
  const keys = listPresets().map((p) => p.key);
  for (const k of ["9-9", "10-10", "11-11", "12-12", "20-10", "8-3", "2-9", "30-4", "tet", "noel", "custom"]) {
    assert.ok(keys.includes(k), `thiếu mẫu ${k}`);
  }
  const now = Date.UTC(2026, 9, 1);
  for (const k of keys) {
    const c = buildPresetContent(k, now);
    assert.ok(matchPalette(c.display.colors), `mẫu ${k} dùng màu ngoài bảng`);
  }
  assert.equal(buildPresetContent("20-10", now).display.colors.primary, "#C2185B");
  assert.equal(buildPresetContent("9-9", now).display.colors.primary, "#D73211");
});
