/** Theme → CSS variables cho toàn storefront. */

export type ThemeColors = {
  primaryColor?: string;
  headerBg?: string;
  fontFamily?: string;
};

const DEFAULT_PRIMARY = "#16C45A";
/** Màu cũ đã publish — nâng lên palette sáng hơn khi render */
const LEGACY_PRIMARY = new Set(["#0F9D58", "#0C8048", "#0A6B3C"]);

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

/** Làm tối màu (0–1). */
export function darkenHex(hex: string, amount = 0.18): string {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - amount;
  return rgbToHex(r * f, g * f, b * f);
}

/** Trộn với trắng → nền nhạt. */
export function lightenHex(hex: string, amount = 0.88): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount
  );
}

export type AlohaCssVars = {
  "--aloha-green": string;
  "--aloha-green-hover": string;
  "--aloha-green-mid": string;
  "--aloha-green-dark": string;
  "--aloha-green-light": string;
  "--aloha-green-bright": string;
  "--aloha-gold": string;
  "--aloha-header": string;
  "--aloha-cream": string;
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

  let headerRaw = theme?.headerBg ? normalizeHex(theme.headerBg) : "";
  if (!headerRaw || LEGACY_PRIMARY.has(headerRaw)) {
    headerRaw = darkenHex(primary, 0.12);
  }

  const mid = darkenHex(primary, 0.12);
  const dark = darkenHex(primary, 0.24);
  const hover = lightenHex(primary, 0.18);
  const light = lightenHex(primary, 0.9);
  const bright = lightenHex(primary, 0.35);

  return {
    "--aloha-green": primary,
    "--aloha-green-hover": hover,
    "--aloha-green-mid": mid,
    "--aloha-green-dark": dark,
    "--aloha-green-light": light,
    "--aloha-green-bright": bright,
    "--aloha-gold": "#F59E0B",
    "--aloha-header": headerRaw,
    "--aloha-cream": "#F7FCF8",
    "--aloha-card": "#FFFFFF",
    "--aloha-ink": "#134E2E",
    "--aloha-muted": "#5B7C6A",
    "--aloha-line": "#D8EEE0",
    "--aloha-price": "#F59E0B",
    "--aloha-sale": "#E11D48",
    "--aloha-font": fontCssStack(theme?.fontFamily),
  };
}

export function themeCssVarsStyle(theme?: ThemeColors | null): string {
  const v = buildThemeCssVars(theme);
  return Object.entries(v)
    .map(([k, val]) => `${k}:${val}`)
    .join(";");
}

/** Áp lên <html> — client sync sau publish. */
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
