import type { Db } from "mongodb";

export type GetDb = () => Promise<Db>;

export type CatalogCtx = {
  getDb: GetDb;
  catalogDb: GetDb;
  getShopDb?: GetDb;
};

export const COL = "aloha_products";
export const INVOICES_COL = "aloha_sales_invoices";
export const CTV_CLICKS_COL = "aloha_shop_ctv_clicks";
export const HOME_CAY_THANH_PHAM_PATH = "CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM TRỒNG SẴN";
