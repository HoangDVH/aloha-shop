/** Render SEO templates với biến dạng [Tên sản phẩm]. */

export const PRODUCT_SEO_VARS = [
  "[Tên sản phẩm]",
  "[Giá]",
  "[Mã SP]",
  "[Danh mục]",
  "[Tên cửa hàng]",
] as const;

export const CATEGORY_SEO_VARS = ["[Tên danh mục]", "[Tên cửa hàng]"] as const;

export type ProductSeoVars = {
  ten?: string;
  gia?: string;
  ma?: string;
  danhMuc?: string;
  tenCuaHang?: string;
};

export type CategorySeoVars = {
  tenDanhMuc?: string;
  tenCuaHang?: string;
};

export function applySeoTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let out = String(template || "");
  for (const [key, val] of Object.entries(vars)) {
    if (!key) continue;
    out = out.split(key).join(val || "");
  }
  return out.replace(/\s+/g, " ").trim();
}

export function productSeoVars(input: ProductSeoVars): Record<string, string> {
  return {
    "[Tên sản phẩm]": String(input.ten || ""),
    "[Giá]": String(input.gia || ""),
    "[Mã SP]": String(input.ma || ""),
    "[Danh mục]": String(input.danhMuc || ""),
    "[Tên cửa hàng]": String(input.tenCuaHang || "ALOHA THẾ GIỚI CHẬU CÂY"),
  };
}

export function categorySeoVars(input: CategorySeoVars): Record<string, string> {
  return {
    "[Tên danh mục]": String(input.tenDanhMuc || ""),
    "[Tên cửa hàng]": String(input.tenCuaHang || "ALOHA THẾ GIỚI CHẬU CÂY"),
  };
}

export function resolveProductSeo(opts: {
  overrideTitle?: string;
  overrideDescription?: string;
  titleTemplate?: string;
  descriptionTemplate?: string;
  vars: ProductSeoVars;
  fallbackTitle: string;
  fallbackDescription: string;
}): { title: string; description: string } {
  const map = productSeoVars(opts.vars);
  const title =
    String(opts.overrideTitle || "").trim() ||
    applySeoTemplate(opts.titleTemplate || "", map) ||
    opts.fallbackTitle;
  const description =
    String(opts.overrideDescription || "").trim() ||
    applySeoTemplate(opts.descriptionTemplate || "", map) ||
    opts.fallbackDescription;
  return { title, description };
}

export function resolveCategorySeo(opts: {
  titleTemplate?: string;
  descriptionTemplate?: string;
  vars: CategorySeoVars;
  fallbackTitle: string;
  fallbackDescription: string;
}): { title: string; description: string } {
  const map = categorySeoVars(opts.vars);
  const title =
    applySeoTemplate(opts.titleTemplate || "", map) || opts.fallbackTitle;
  const description =
    applySeoTemplate(opts.descriptionTemplate || "", map) ||
    opts.fallbackDescription;
  return { title, description };
}
