import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { GIFT_COLLECTIONS_COL, type GiftCollectionItem } from './types.js';

export const INITIAL_GIFT_SEEDS: Omit<GiftCollectionItem, '_id'>[] = [
  {
    slug: 'nguoi-thuong',
    title: 'Chậu Cây Màu Hồng – Món Quà Dịu Dàng Dành Cho Nàng',
    subtitle: 'Gửi chút ngọt ngào, tươi thắm và năng lượng tích cực đến người phụ nữ bạn trân quý.',
    tag: 'Tâm điểm 20/10',
    recipientType: 'nguoi-thuong',
    image: '/banners/ve-aloha/real-hong-ngoc-2010.jpg',
    quote: 'Có những món quà không cần nói quá nhiều điều. Chỉ cần đặt giữa bàn làm việc, cũng đủ nhắc nhớ về một người luôn thương.',
    includedItems: 'Chậu gốm nghệ thuật + Nơ nhung + Thiệp viết tay + Túi quai trong suốt',
    linkedProductCodes: ['CBHNTL', 'HMD35', 'CBVMHN'],
    order: 1,
    isActive: true,
  },
  {
    slug: 'gia-dinh',
    title: 'Quà Tặng Gia Đình & Mẹ – Gửi Một Chút Xanh, Giữ Trọn Yêu Thương',
    subtitle: 'Lời nguyện ước bình an, may mắn và trường thọ gửi đến người thân quan trọng nhất.',
    tag: 'Hiếu đạo & Ấm êm',
    recipientType: 'gia-dinh',
    image: '/banners/ve-aloha/real-binh-an.jpg',
    quote: 'Mỗi mầm cây lớn lên cùng năm tháng là lời chúc bình an, gia đình hòa thuận, vẹn tròn hạnh phúc.',
    includedItems: 'Chậu Bát Tràng men mộc + Đĩa lót + Thiệp kraft mộc mạc + Nơ ruy băng',
    linkedProductCodes: ['TPBADB', 'CBHPMM'],
    order: 2,
    isActive: true,
  },
  {
    slug: 'khai-truong',
    title: 'Cây Kim Tiền & Phát Tài – Lời Chúc Khởi Đầu Thuận Lợi, Đắc Lộc',
    subtitle: 'Tài lộc vượng khí, thịnh vượng bền lâu mừng khai trương, tân gia và thăng tiến.',
    tag: 'Khai trương & Thăng chức',
    recipientType: 'khai-truong',
    image: '/banners/ve-aloha/real-hanh-phuc.jpg',
    quote: 'Khai trương là ngày mở đầu cho một hành trình mới. Món quà trao tay gửi gắm niềm tin về sự hanh thông và phát đạt.',
    includedItems: 'Chậu sứ bo viền sang trọng + Bảng gỗ chúc mừng + Nơ đỏ phong thủy + Túi quà',
    linkedProductCodes: ['CBHPMM', 'TPBADB'],
    order: 3,
    isActive: true,
  },
  {
    slug: 'ban-lam-viec',
    title: 'Chậu Cây Bàn Làm Việc – Góc Xanh Thư Giãn, Bền Bỉ Tri Kỷ',
    subtitle: 'Thanh lọc không khí, giảm căng thẳng bức xạ máy tính cho bạn thân và đồng nghiệp.',
    tag: 'Đồng nghiệp & Bạn thân',
    recipientType: 'ban-lam-viec',
    image: '/banners/ve-aloha/real-sen-da.jpg',
    quote: 'Sen đá kiên định và bền bỉ qua năm tháng, nhỏ nhắn xinh xắn như lời động viên lặng lẽ mỗi ngày đi làm.',
    includedItems: 'Chậu gốm hạt dẻ + Phối sỏi tự nhiên + Thiệp chúc + Túi quai xách',
    linkedProductCodes: ['HDLS3MSD'],
    order: 4,
    isActive: true,
  },
  {
    slug: 'doanh-nghiep',
    title: 'Quà Tặng Doanh Nghiệp (B2B) – Giải Pháp Cây Xanh Trọn Gói',
    subtitle: 'Nâng tầm văn hóa doanh nghiệp, gắn kết bền lâu và khẳng định vị thế thương hiệu.',
    tag: 'B2B & Sự kiện lớn',
    recipientType: 'doanh-nghiep',
    image: '/banners/trust/dich-vu-goi-qua.webp',
    quote: 'Thay cho những món quà quen thuộc, cây xanh mang biểu trưng cho sự phát triển sinh sôi, vươn tầm và gắn kết dài lâu.',
    includedItems: 'Chậu in logo + Túi giấy quai mộc cửa kính + Thẻ cẩm nang + Hóa đơn VAT',
    linkedProductCodes: ['CBHNTL', 'HMD35', 'CBHPMM'],
    order: 5,
    isActive: true,
  },
];

export async function ensureGiftIndexes(db: Db): Promise<void> {
  const col = db.collection<GiftCollectionItem>(GIFT_COLLECTIONS_COL);
  try {
    await Promise.all([
      col.createIndex({ isActive: 1, order: 1 }),
      col.createIndex({ slug: 1 }, { unique: true }),
      col.createIndex({ recipientType: 1 }),
    ]);

    // Tự động seed dữ liệu mẫu ban đầu nếu collection rỗng
    const count = await col.countDocuments();
    if (count === 0) {
      const now = new Date().toISOString();
      const docs = INITIAL_GIFT_SEEDS.map((s) => ({
        ...s,
        createdAt: now,
        updatedAt: now,
      }));
      await col.insertMany(docs as any);
      console.log(`[shopGifts] Đã seed ${docs.length} thẻ quà tặng mẫu thành công.`);
    }
  } catch (err: any) {
    console.warn('[shopGifts] ensureGiftIndexes:', err?.message || err);
  }
}

export async function listActiveGifts(db: Db): Promise<GiftCollectionItem[]> {
  const col = db.collection<GiftCollectionItem>(GIFT_COLLECTIONS_COL);
  return col.find({ isActive: true }).sort({ order: 1, _id: 1 }).toArray();
}

export async function getGiftBySlug(db: Db, slug: string): Promise<GiftCollectionItem | null> {
  const col = db.collection<GiftCollectionItem>(GIFT_COLLECTIONS_COL);
  return col.findOne({ slug, isActive: true });
}

export async function listAllGiftsAdmin(db: Db): Promise<GiftCollectionItem[]> {
  const col = db.collection<GiftCollectionItem>(GIFT_COLLECTIONS_COL);
  return col.find({}).sort({ order: 1, _id: 1 }).toArray();
}

export async function createGiftAdmin(db: Db, doc: Omit<GiftCollectionItem, '_id'>): Promise<GiftCollectionItem> {
  const col = db.collection<GiftCollectionItem>(GIFT_COLLECTIONS_COL);
  const now = new Date().toISOString();
  const insertData = {
    ...doc,
    createdAt: now,
    updatedAt: now,
  };
  const res = await col.insertOne(insertData as any);
  return { ...insertData, _id: res.insertedId.toString() };
}

export async function updateGiftAdmin(db: Db, idOrSlug: string, patch: Partial<GiftCollectionItem>): Promise<boolean> {
  const col = db.collection<GiftCollectionItem>(GIFT_COLLECTIONS_COL);
  const query = ObjectId.isValid(idOrSlug) ? { _id: new ObjectId(idOrSlug) as any } : { slug: idOrSlug };
  const res = await col.updateOne(query, {
    $set: {
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  });
  return res.matchedCount > 0;
}

export async function deleteGiftAdmin(db: Db, idOrSlug: string): Promise<boolean> {
  const col = db.collection<GiftCollectionItem>(GIFT_COLLECTIONS_COL);
  const query = ObjectId.isValid(idOrSlug) ? { _id: new ObjectId(idOrSlug) as any } : { slug: idOrSlug };
  const res = await col.deleteOne(query);
  return res.deletedCount > 0;
}
