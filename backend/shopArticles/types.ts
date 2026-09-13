/** CMS bài viết web shop — collection Mongo. */

export const ARTICLES_COL = "aloha_shop_articles";
export const PREVIOUS_SLUGS_MAX = 20;
export const PRODUCT_MAS_MAX = 12;

export type ShopArticleDoc = {
  _id?: unknown;
  title: string;
  slug: string;
  previousSlugs: string[];
  category: string;
  coverUrl: string;
  /** YouTube URL / embed, hoặc /uploads/...mp4|webm */
  videoUrl: string;
  excerpt: string;
  bodyHtml: string;
  productMas: string[];
  publishedAt: string;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type ShopArticlePublic = {
  id: string;
  title: string;
  slug: string;
  category: string;
  coverUrl: string;
  videoUrl?: string;
  excerpt: string;
  bodyHtml?: string;
  productMas?: string[];
  publishedAt: string;
  updatedAt: string;
};

export type ShopArticleAdmin = ShopArticlePublic & {
  previousSlugs: string[];
  videoUrl: string;
  bodyHtml: string;
  productMas: string[];
  visible: boolean;
  createdAt: string;
  updatedBy: string | null;
};
