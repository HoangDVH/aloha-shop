/** Theme → CSS variables storefront — bảng màu đề xuất:
 *  Off-white #FAF9F5 · White #FFFFFF
 *  Green #5F7D4E · Dark green #3F5F35 · Terracotta #C67B5C (CTA/badge)
 *  Text #292B27 · Muted #73766F · Line #EBE8DC · Hover #EEF2EB
 */

export type ThemeColors = {
  primaryColor?: string;
  headerBg?: string;
  fontFamily?: string;
};

export const ALOHA_PALETTE = {
  cream: "#FAF9F5",
  creamDark: "#FEF0D3",
  creamLight: "#FFFFFF",
  hoverBg: "#EEF2EB",
  white: "#FFFFFF",
  surface: "#F5F5F5",
  green: "#5F7D4E",
  darkGreen: "#3F5F35",
  terracotta: "#C67B5C",
  terracottaHover: "#B0684A",
  ink: "#292B27",
  muted: "#73766F",
  line: "#EBE8DC",
} as const;

const DEFAULT_PRIMARY = ALOHA_PALETTE.green;
const DEFAULT_HEADER = ALOHA_PALETTE.cream;

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
  ].map((c) => c.toUpperCase())
);

const LEGACY_HEADER = new Set(
  ["#F7F4EC", "#FBFAF6", "#FFF8DC", "#FAF3E0", "#FFFDD0", "#FFFEE8"].map((c) =>
    c.toUpperCase()
  )
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

  const dark = useBrand ? ALOHA_PALETTE.darkGreen : darkenHex(primary, 0.2);
  const mid = dark;
  const hover = useBrand ? ALOHA_PALETTE.darkGreen : darkenHex(primary, 0.1);
  const light = useBrand ? ALOHA_PALETTE.hoverBg : lightenHex(primary, 0.92);
  const bright = lightenHex(primary, 0.35);

  return {
    "--aloha-green": primary,
    "--aloha-green-hover": hover,
    "--aloha-green-mid": mid,
    "--aloha-green-dark": dark,
    "--aloha-green-light": useBrand ? ALOHA_PALETTE.creamLight : light,
    "--aloha-green-bright": bright,
    "--aloha-gold": ALOHA_PALETTE.terracotta,
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
    "--aloha-price": primary,
    "--aloha-sale": "#D45454",
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
