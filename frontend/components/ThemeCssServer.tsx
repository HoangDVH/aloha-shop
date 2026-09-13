import { fetchAppearance } from "@/lib/appearance";
import { googleFontHref, themeCssVarsStyle } from "@/lib/themeCss";

/** Inject CSS variables từ appearance đã xuất bản (SSR — tránh flash màu cũ). */
export async function ThemeCssServer() {
  const app = await fetchAppearance();
  const css = `:root{${themeCssVarsStyle(app.theme)}}`;
  const fontHref = googleFontHref(app.theme?.fontFamily);
  return (
    <>
      {fontHref ? (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link id="aloha-theme-font" rel="stylesheet" href={fontHref} />
        </>
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}
