export interface GiftCollectionItem {
  _id?: string;
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  recipientType: 'nguoi-thuong' | 'gia-dinh' | 'khai-truong' | 'ban-lam-viec' | 'doanh-nghiep' | string;
  image: string;
  quote: string;
  includedItems: string;
  linkedProductCodes: string[];
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const GIFT_COLLECTIONS_COL = 'aloha_gift_collections';
