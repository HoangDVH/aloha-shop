import { fetchAppearance } from "@/lib/appearance";
import { googleFontHref, themeCssVarsStyle } from "@/lib/themeCss";

const HERO_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&family=Great+Vibes&display=swap";

/** Inject CSS variables từ appearance đã xuất bản (SSR — tránh flash màu cũ). */
export async function ThemeCssServer() {
  const app = await fetchAppearance();
  const css = `:root{${themeCssVarsStyle(app.theme)}}`;
  const fontHref = googleFontHref(app.theme?.fontFamily);
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link id="aloha-hero-fonts" rel="stylesheet" href={HERO_FONT_HREF} />
      {fontHref && fontHref !== HERO_FONT_HREF ? (
        <link id="aloha-theme-font" rel="stylesheet" href={fontHref} />
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}
