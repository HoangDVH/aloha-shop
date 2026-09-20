/** Theme → CSS variables storefront — brand guide Aloha (đúng 100%):
 *  Primary #2E7D32 · Hover #4CAF50 · Pastel #E8F5E9 · Soft #F1F8EF
 *  Warm Cream #FDF6E3 · Pale Yellow #FFF8E1 · Brown border #E8DCC6
 *  Accent #FF6800 / #FF6F61 · Text #333 / #6B7280 · Line #E5E7EB
 *  Price/Sale #EF4444
 */

export type ThemeColors = {
  primaryColor?: string;
  headerBg?: string;
  fontFamily?: string;
};

export const ALOHA_PALETTE = {
  cream: "#F1F8EF",
  creamDark: "#FFF8E1",
  creamLight: "#FFFFFF",
  warmCream: "#FDF6E3",
  hoverBg: "#E8F5E9",
  white: "#FFFFFF",
  surface: "#FFFFFF",
  green: "#2E7D32",
  lightGreen: "#4CAF50",
  darkGreen: "#1B5E20",
  terracotta: "#FF6F61",
  terracottaHover: "#E85A4F",
  shock: "#FF6800",
  ink: "#333333",
  muted: "#6B7280",
  placeholder: "#9CA3AF",
  line: "#E5E7EB",
  borderBrown: "#E8DCC6",
  price: "#EF4444",
  sale: "#EF4444",
} as const;

const DEFAULT_PRIMARY = ALOHA_PALETTE.green;
const DEFAULT_HEADER = ALOHA_PALETTE.white;

const LEGACY_PRIMARY = new Set(
  [
    "#0F9D58",
    "#0C8048",
    "#0A6B3C",
    "#16C45A",
    "#12A34A",
    "#22C55E",
    "#0D9488",
    "#3DDC84",
    "#134E2E",
    /* palette cũ trước brand guide */
    "#5F7D4E",
    "#3F5F35",
    "#7A9A68",
  ].map((c) => c.toUpperCase())
);

const LEGACY_HEADER = new Set(
  [
    "#F7F4EC",
    "#FBFAF6",
    "#FFF8DC",
    "#FAF3E0",
    "#FFFDD0",
    "#FFFEE8",
    "#FEF0D3",
    "#FAF9F5",
    "#FDF6E3",
    "#FFF8E1",
  ].map((c) => c.toUpperCase())
);

const FONT_CSS: Record<string, string> = {
  system:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  be_vietnam: '"Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif',
  nunito: "Nunito, ui-sans-serif, system-ui, sans-serif",
  roboto: "Roboto, ui-sans-serif, system-ui, sans-serif",
};

export function fontCssStack(fontFamily?: string | null): string {
  return FONT_CSS[String(fontFamily || "system")] || FONT_CSS.system;
}

export function googleFontHref(fontFamily?: string | null): string | null {
  const id = String(fontFamily || "system");
  if (id === "be_vietnam") {
    return "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap";
  }
  if (id === "nunito") {
    return "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap";
  }
  if (id === "roboto") {
    return "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap";
  }
  return null;
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function normalizeHex(input: string | undefined | null): string {
  const raw = String(input || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return DEFAULT_PRIMARY;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((x) => clamp(x).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function darkenHex(hex: string, amount = 0.18): string {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - amount;
  return rgbToHex(r * f, g * f, b * f);
}

export function lightenHex(hex: string, amount = 0.88): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount
  );
}

export function isLightColor(hex: string | undefined | null): boolean {
  const { r, g, b } = hexToRgb(hex || DEFAULT_HEADER);
  return 0.299 * r + 0.587 * g + 0.114 * b > 186;
}

export type AlohaCssVars = {
  "--aloha-green": string;
  "--aloha-green-hover": string;
  "--aloha-green-mid": string;
  "--aloha-green-dark": string;
  "--aloha-green-light": string;
  "--aloha-green-bright": string;
  "--aloha-gold": string;
  "--aloha-terracotta": string;
  "--aloha-terracotta-hover": string;
  "--aloha-header": string;
  "--aloha-cream": string;
  "--aloha-cream-dark": string;
  "--aloha-cream-light": string;
  "--aloha-surface": string;
  "--aloha-card": string;
  "--aloha-ink": string;
  "--aloha-muted": string;
  "--aloha-line": string;
  "--aloha-price": string;
  "--aloha-sale": string;
  "--aloha-border-brown": string;
  "--aloha-shock": string;
  "--aloha-font": string;
};

export function buildThemeCssVars(theme?: ThemeColors | null): AlohaCssVars {
  let primary = normalizeHex(theme?.primaryColor || DEFAULT_PRIMARY);
  if (LEGACY_PRIMARY.has(primary)) primary = DEFAULT_PRIMARY;

  let headerRaw = theme?.headerBg ? normalizeHex(theme.headerBg) : DEFAULT_HEADER;
  if (LEGACY_PRIMARY.has(headerRaw) || LEGACY_HEADER.has(headerRaw)) {
    headerRaw = DEFAULT_HEADER;
  }

  const useBrand =
    primary === ALOHA_PALETTE.green ||
    LEGACY_PRIMARY.has(normalizeHex(theme?.primaryColor));

  const dark = useBrand ? ALOHA_PALETTE.darkGreen : darkenHex(primary, 0.22);
  const mid = useBrand ? ALOHA_PALETTE.green : darkenHex(primary, 0.12);
  const hover = useBrand ? ALOHA_PALETTE.lightGreen : darkenHex(primary, 0.08);
  const light = useBrand ? ALOHA_PALETTE.hoverBg : lightenHex(primary, 0.92);
  const bright = useBrand ? ALOHA_PALETTE.lightGreen : lightenHex(primary, 0.35);

  return {
    "--aloha-green": primary,
    "--aloha-green-hover": hover,
    "--aloha-green-mid": mid,
    "--aloha-green-dark": dark,
    "--aloha-green-light": light,
    "--aloha-green-bright": bright,
    "--aloha-gold": ALOHA_PALETTE.shock,
    "--aloha-terracotta": ALOHA_PALETTE.terracotta,
    "--aloha-terracotta-hover": ALOHA_PALETTE.terracottaHover,
    "--aloha-header": headerRaw,
    "--aloha-cream": ALOHA_PALETTE.cream,
    "--aloha-cream-dark": ALOHA_PALETTE.creamDark,
    "--aloha-cream-light": ALOHA_PALETTE.creamLight,
    "--aloha-surface": ALOHA_PALETTE.surface,
    "--aloha-card": ALOHA_PALETTE.white,
    "--aloha-ink": ALOHA_PALETTE.ink,
    "--aloha-muted": ALOHA_PALETTE.muted,
    "--aloha-line": ALOHA_PALETTE.line,
    "--aloha-price": ALOHA_PALETTE.price,
    "--aloha-sale": ALOHA_PALETTE.sale,
    "--aloha-border-brown": ALOHA_PALETTE.borderBrown,
    "--aloha-shock": ALOHA_PALETTE.shock,
    "--aloha-font": fontCssStack(theme?.fontFamily),
  };
}

export function themeCssVarsStyle(theme?: ThemeColors | null): string {
  const v = buildThemeCssVars(theme);
  return Object.entries(v)
    .map(([k, val]) => `${k}:${val}`)
    .join(";");
}

export function applyThemeCssVars(theme?: ThemeColors | null) {
  if (typeof document === "undefined") return;
  const v = buildThemeCssVars(theme);
  const root = document.documentElement;
  for (const [k, val] of Object.entries(v)) {
    root.style.setProperty(k, val);
  }
  const href = googleFontHref(theme?.fontFamily);
  const id = "aloha-theme-font";
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!href) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}
