import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import type { GetDb } from "../auth/middleware.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { geminiKey, geminiModel } from "../plantDoctor/gemini.js";
import { ALOHA_KNOWLEDGE } from "./knowledge.js";

type ChatMessage = { role: "user" | "assistant"; content: string };

type PageContext = {
  pathname?: string;
  productName?: string;
  productCode?: string;
  productPrice?: number;
};

type ProductCard = {
  ma: string;
  ten: string;
  giaBan: number;
  image?: string;
  url: string;
  ton?: number;
  webBadge?: string;
};

type GiftCard = {
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  url: string;
  buttonText: string;
  image?: string;
};

type SearchLink = {
  label: string;
  url: string;
  query: string;
};

type ProductSearchResult = {
  cards: ProductCard[];
  giftCard?: GiftCard;
  searchLink?: SearchLink;
};

type OrderCard = {
  code: string;
  status: string;
  statusText: string;
  total: number;
  receiver: string;
  createdAt?: string;
};

const ORDER_CODE_REGEX = /\b(DH\d{4,8}|WEB-[A-Z0-9-]+)\b/i;

function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function extractCleanKeywords(text: string): string {
  const norm = removeVietnameseTones(text)
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const stopWords = new Set([
    "toi", "muon", "mua", "can", "tim", "cho", "minh", "hoi", "shop", "oi",
    "co", "ban", "ko", "khong", "a", "da", "em", "nhe", "nha", "chut", "ti",
    "xem", "cac", "nhung", "mau", "loai", "cay"
  ]);
  const words = norm.split(" ").filter((w) => w && !stopWords.has(w));
  return words.join(" ").trim();
}

const SPECIFIC_SPECIES_PATTERNS = [
  { match: /lưỡi hổ|luoi ho/i, regex: /LƯỠI HỔ/i, label: "Lưỡi Hổ", query: "luoi ho" },
  { match: /kim tiền|kim tien/i, regex: /KIM TIỀN/i, label: "Kim Tiền", query: "kim tien" },
  { match: /kim ngân|kim ngan/i, regex: /KIM NGÂN/i, label: "Kim Ngân", query: "kim ngan" },
  { match: /sen đá|sen da/i, regex: /SEN ĐÁ/i, label: "Sen Đá", query: "sen da" },
  { match: /xương rồng|xuong rong/i, regex: /XƯƠNG RỒNG/i, label: "Xương Rồng", query: "xuong rong" },
  { match: /trầu bà|trau ba/i, regex: /TRẦU BÀ/i, label: "Trầu Bà", query: "trau ba" },
  { match: /monstera|nam mỹ|nam my/i, regex: /MONSTERA|NAM MỸ/i, label: "Monstera", query: "monstera" },
  { match: /bàng|bang|singapore/i, regex: /BÀNG/i, label: "Bàng Singapore", query: "bang singapore" },
  { match: /hạnh phúc|hanh phuc/i, regex: /HẠNH PHÚC/i, label: "Hạnh Phúc", query: "hanh phuc" },
  { match: /phát tài|phat tai/i, regex: /PHÁT TÀI/i, label: "Phát Tài", query: "phat tai" },
  { match: /ngọc ngân|ngoc ngan/i, regex: /NGỌC NGÂN/i, label: "Ngọc Ngân", query: "ngoc ngan" },
  { match: /phú quý|phu quy/i, regex: /PHÚ QUÝ/i, label: "Phú Quý", query: "phu quy" },
  { match: /trúc bách hợp|truc bach hop/i, regex: /TRÚC BÁCH HỢP/i, label: "Trúc Bách Hợp", query: "truc bach hop" },
  { match: /lan chi/i, regex: /LAN CHI/i, label: "Lan Chi", query: "lan chi" },
  { match: /vạn lộc|van loc/i, regex: /VẠN LỘC/i, label: "Vạn Lộc", query: "van loc" },
  { match: /lan ý|lan y/i, regex: /LAN Ý/i, label: "Lan Ý", query: "lan y" },
  { match: /cần thăng|can thang/i, regex: /CẦN THĂNG/i, label: "Cần Thăng", query: "can thang" },
  { match: /dương xỉ|duong xi/i, regex: /DƯƠNG XỈ/i, label: "Dương Xỉ", query: "duong xi" },
  { match: /hồng môn|hong mon/i, regex: /HỒNG MÔN/i, label: "Hồng Môn", query: "hong mon" },
  { match: /cẩm thạch|cam thach/i, regex: /CẨM THẠCH/i, label: "Cây Cẩm Thạch", query: "cam thach" },
  { match: /mai hồng ngọc|mai hong ngoc/i, regex: /MAI HỒNG NGỌC|HỒNG NGỌC/i, label: "Mai Hồng Ngọc", query: "mai hong ngoc" },
  { match: /tùng la hán|tung la han|tùng vạn niên|tung van nien/i, regex: /TÙNG LA HÁN|TÙNG VẠN NIÊN/i, label: "Tùng La Hán", query: "tung la han" },
  { match: /thường xuân|thuong xuan/i, regex: /THƯỜNG XUÂN/i, label: "Thường Xuân", query: "thuong xuan" },
  { match: /ngũ gia bì|ngu gia bi/i, regex: /NGŨ GIA BÌ/i, label: "Ngũ Gia Bì", query: "ngu gia bi" },
  { match: /cây để bàn|cay de ban/i, regex: /ĐỂ BÀN|MINI/i, label: "Cây Để Bàn", query: "cay de ban" },
  { match: /đá mài|da mai/i, regex: /ĐÁ MÀI/i, label: "Chậu Đá Mài", query: "da mai" },
  { match: /composite/i, regex: /COMPOSITE/i, label: "Chậu Composite", query: "composite" },
  { match: /xi măng|xi mang/i, regex: /XI MĂNG/i, label: "Chậu Xi Măng", query: "xi mang" },
  { match: /gốm sứ|men sứ|chậu gốm|gom su|men su|chau gom/i, regex: /GỐM|SỨ/i, label: "Chậu Gốm Sứ", query: "gom su" },
  { match: /đất nung|dat nung/i, regex: /ĐẤT NUNG/i, label: "Chậu Đất Nung", query: "dat nung" },
  { match: /đôn|don/i, regex: /ĐÔN/i, label: "Đôn Kê Chậu", query: "don" },
  { match: /chậu cây|chậu|chau cay|chau/i, regex: /CHẬU/i, label: "Chậu Cây", query: "chau cay" },
];

const GIFT_DESTINATIONS = [
  {
    slug: "gia-dinh",
    regex: /gia đình|gia dinh|mẹ|me|bố mẹ|bo me|ba mẹ|ba me|cha mẹ|cha me|ông bà|ong ba|hiếu thảo|hieu thao|người thân|nguoi than/i,
    title: "Quà Tặng Mẹ & Gia Đình",
    subtitle: "Thay lời cảm ơn những người luôn dành cho bạn một mái nhà.",
    tag: "Hiếu đạo & Ấm êm",
    url: "/qua-tang/gia-dinh#san-pham",
    buttonText: "Xem bộ sưu tập Quà tặng Gia Đình & Mẹ",
    image: "https://cdn2-retail-images.kiotviet.vn/2026/08/03/alohanguyen/6e088133b723446b9fa0b7c9eb19c499.jpg",
  },
  {
    slug: "nguoi-thuong",
    regex: /người thương|nguoi thuong|người yêu|nguoi yeu|bạn gái|ban gai|vợ|vo|nàng|nang|phụ nữ|phu nu|20\/10|8\/3|valentine/i,
    title: "Chậu Cây Xinh Dành Riêng Cho Nàng",
    subtitle: "Không cần chờ dịp đặc biệt để nói “anh nhớ em”",
    tag: "Dành Cho Nàng & Người Thương",
    url: "/qua-tang/nguoi-thuong#san-pham",
    buttonText: "Xem bộ sưu tập Dành cho Nàng",
    image: "/uploads/gifts/gift_1791601012577_1791544691637_5098661755940818.jpg",
  },
  {
    slug: "khai-truong",
    regex: /khai trương|khai truong|thăng chức|thang chuc|tân gia|tan gia|mừng|mung|vượng tài|tai loc|phát tài|khai mạc/i,
    title: "Quà Mừng Khai Trương & Thăng Chức",
    subtitle: "Đánh dấu cột mốc đáng tự hào bằng một món quà thật chỉn chu.",
    tag: "Khai trương & Thăng chức",
    url: "/qua-tang/khai-truong#san-pham",
    buttonText: "Xem bộ sưu tập Khai Trương & Thăng Chức",
    image: "https://cdn2-retail-images.kiotviet.vn/2026/07/13/alohanguyen/f1023e4bb6d244ab8d04c0e7f5487226.jpg",
  },
  {
    slug: "ban-lam-viec",
    regex: /bàn làm việc|ban lam viec|đồng nghiệp|dong nghiep|bạn thân|ban than|văn phòng|van phong|sếp|sep|sinh nhật|sinh nhat/i,
    title: "Góc Xanh Tặng Đồng Nghiệp & Bạn Thân",
    subtitle: "Một bất ngờ nhỏ cho người vẫn cùng bạn đi qua những ngày bận rộn.",
    tag: "Đồng nghiệp & Bạn thân",
    url: "/qua-tang/ban-lam-viec#san-pham",
    buttonText: "Xem bộ sưu tập Quà tặng Đồng Nghiệp",
    image: "https://cdn2-retail-images.kiotviet.vn/2026/08/04/alohanguyen/b6f40d30fe1d4b3fa42338be32184ec2.jpg",
  },
  {
    slug: "doanh-nghiep",
    regex: /doanh nghiệp|doanh nghiep|công ty|cong ty|b2b|đối tác|doi tac|số lượng lớn|in logo|khắc tag|hội nghị|đại hội/i,
    title: "Quà Tặng Doanh Nghiệp (B2B)",
    subtitle: "Cung cấp chậu cây số lượng lớn, in logo chậu & túi quà theo yêu cầu, đầy đủ VAT.",
    tag: "Quà Tặng Doanh Nghiệp B2B",
    url: "/qua-tang/doanh-nghiep#nhan-bao-gia",
    buttonText: "Xem giải pháp Quà tặng Doanh Nghiệp",
    image: "/banners/trust/dich-vu-goi-qua.webp",
  },
];

function mapOrderStatusText(status: string): string {
  switch (status) {
    case "cho_xac_nhan":
      return "Chờ Aloha kiểm tra cây & gửi ảnh Zalo xác nhận";
    case "da_xac_nhan":
      return "Đã xác nhận đơn hàng · Đang đóng gói";
    case "dang_giao":
      return "Đang trên đường giao hàng";
    case "hoan_thanh":
      return "Giao hàng thành công";
    case "huy":
    case "da_huy":
      return "Đơn hàng đã hủy";
    default:
      return "Đang xử lý";
  }
}

function chatbotProductFilter(conditions: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    $and: [
      { mergedInto: { $exists: false } },
      { $or: [{ isActive: { $ne: false } }, { isActive: { $exists: false } }] },
      {
        $or: [
          { banTrucTiep: { $ne: false } },
          { banTrucTiep: { $exists: false } },
        ],
      },
      {
        $or: [{ hienThiWeb: { $ne: false } }, { hienThiWeb: { $exists: false } }],
      },
      {
        $or: [
          { anh: { $type: "string", $regex: "\\S" } },
          { "images.0": { $exists: true, $nin: [null, ""] } },
        ],
      },
      { giaBan: { $gt: 0 } },
      conditions,
    ],
  };
}

function mapDocToProductCard(d: any): ProductCard {
  return {
    ma: String(d.ma || "").trim(),
    ten: String(d.ten || "").trim(),
    giaBan: Number(d.giaBan || 0),
    image: Array.isArray(d.images) && d.images[0] ? d.images[0] : d.image || undefined,
    url: `/sp/${encodeURIComponent(String(d.ma || "").trim())}`,
    ton: typeof d.ton === "number" ? d.ton : 0,
    webBadge: typeof d.webBadge === "string" ? d.webBadge : undefined,
  };
}

function computeProductScore(d: any, currentCode?: string): number {
  if (currentCode && d.ma === currentCode) return -100;
  let s = 0;
  const ton = Number(d.ton) || 0;
  const badge = String(d.webBadge || "").toLowerCase();

  // 1. Ưu tiên hàng có tồn kho > 0
  if (ton > 0) {
    s += 100 + Math.min(ton, 20);
  }

  // 2. Ưu tiên hàng bán chạy (kể cả khi ton = 0 hoặc đặt trước)
  if (badge === "ban_chay" || badge === "ban_chay_sap_het") {
    s += 60;
  } else if (badge === "noi_bat" || badge === "uu_dai") {
    s += 30;
  }
  return s;
}

async function searchProductsByText(
  db: Db,
  text: string,
  context?: PageContext,
  maxItems = 4
): Promise<ProductSearchResult> {
  const cards: ProductCard[] = [];
  const seenCodes = new Set<string>();
  let giftCard: GiftCard | undefined = undefined;
  let searchLink: SearchLink | undefined = undefined;

  const queryAndContext = `${text} ${context?.productName || ""}`;
  const normQuery = removeVietnameseTones(queryAndContext);

  // 1. Nhận diện chủng loại cụ thể (Species/Family) TRƯỚC TIÊN (hỗ trợ cả có dấu & không dấu)
  const matchedSpecies = SPECIFIC_SPECIES_PATTERNS.find(
    (p) => p.match.test(queryAndContext) || p.match.test(normQuery)
  );

  // Nhận diện Quà Tặng (Gia đình, người thương, khai trương, đồng nghiệp, doanh nghiệp...)
  const matchedGift = GIFT_DESTINATIONS.find(
    (g) => g.regex.test(queryAndContext) || g.regex.test(normQuery)
  );
  if (matchedGift) {
    giftCard = {
      slug: matchedGift.slug,
      title: matchedGift.title,
      subtitle: matchedGift.subtitle,
      tag: matchedGift.tag,
      url: matchedGift.url,
      buttonText: matchedGift.buttonText,
      image: matchedGift.image,
    };
  }

  // 1A. NẾU KHÁCH TÌM LOẠI CÂY / CHẬU CỤ THỂ (vd: cây kim tiền, cây lưỡi hổ, chậu xi măng...)
  if (matchedSpecies) {
    searchLink = {
      label: `Xem tất cả ${matchedSpecies.label}`,
      url: `/tim?q=${encodeURIComponent(matchedSpecies.query)}`,
      query: matchedSpecies.label,
    };

    try {
      const speciesDocs = await db
        .collection("aloha_products")
        .find(chatbotProductFilter({ ten: { $regex: matchedSpecies.regex } }))
        .project({ ma: 1, ten: 1, giaBan: 1, images: 1, image: 1, categoryName: 1, ton: 1, webBadge: 1 })
        .limit(maxItems + 8)
        .toArray();

      // Ưu tiên sản phẩm: ton > 0 hoặc bán chạy lên đầu
      speciesDocs.sort((a, b) => computeProductScore(b, context?.productCode) - computeProductScore(a, context?.productCode));

      for (const d of speciesDocs) {
        if (cards.length >= maxItems) break;
        if (!seenCodes.has(d.ma)) {
          seenCodes.add(d.ma);
          cards.push(mapDocToProductCard(d));
        }
      }

      // Nếu đã tìm được ít nhất 2 mẫu cùng loại -> trả về ngay
      if (cards.length >= 2) {
        return { cards, giftCard, searchLink };
      }

      // Nếu chỉ có 1 mẫu, tìm thêm các sản phẩm CÙNG DANH MỤC (categoryName) của sản phẩm đó
      if (cards.length > 0 && speciesDocs[0]?.categoryName) {
        const catDocs = await db
          .collection("aloha_products")
          .find(chatbotProductFilter({ categoryName: speciesDocs[0].categoryName }))
          .project({ ma: 1, ten: 1, giaBan: 1, images: 1, image: 1, ton: 1, webBadge: 1 })
          .limit(maxItems - cards.length + 4)
          .toArray();

        catDocs.sort((a, b) => computeProductScore(b, context?.productCode) - computeProductScore(a, context?.productCode));

        for (const d of catDocs) {
          if (cards.length >= maxItems) break;
          if (!seenCodes.has(d.ma)) {
            seenCodes.add(d.ma);
            cards.push(mapDocToProductCard(d));
          }
        }
        return { cards, giftCard, searchLink };
      }
    } catch {
      // bỏ qua
    }
  }

  // 1B. NẾU KHÁCH TÌM BỘ SƯU TẬP QUÀ TẶNG (không hỏi cây riêng lẻ)
  if (!matchedSpecies && matchedGift) {
    searchLink = {
      label: matchedGift.buttonText,
      url: matchedGift.url,
      query: matchedGift.title,
    };

    if (matchedGift.slug !== "doanh-nghiep") {
      try {
        const giftCol = await db.collection("aloha_gift_collections").findOne({ slug: matchedGift.slug });
        const linkedCodes: string[] = Array.isArray(giftCol?.linkedProductCodes) ? giftCol.linkedProductCodes : [];
        if (linkedCodes.length > 0) {
          const giftDocs = await db
            .collection("aloha_products")
            .find(chatbotProductFilter({ ma: { $in: linkedCodes } }))
            .project({ ma: 1, ten: 1, giaBan: 1, images: 1, image: 1, ton: 1, webBadge: 1 })
            .toArray();

          giftDocs.sort((a, b) => computeProductScore(b, context?.productCode) - computeProductScore(a, context?.productCode));

          for (const d of giftDocs) {
            if (cards.length >= maxItems) break;
            if (!seenCodes.has(d.ma)) {
              seenCodes.add(d.ma);
              cards.push(mapDocToProductCard(d));
            }
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (cards.length > 0 || matchedGift.slug === "doanh-nghiep") {
      return { cards, giftCard, searchLink };
    }
  }

  // 2. Nếu không tìm thấy loại cây cụ thể -> Tìm theo nhóm nhu cầu lớn (quà tặng, để bàn, chậu, lọc không khí...)
  if (cards.length < maxItems) {
    try {
      let groupRegex: RegExp | null = null;
      let groupQuery = "";
      if (
        /tặng|tang|quà|qua|mừng|mung|tân gia|tan gia|khai trương|khai truong|sinh nhật|sinh nhat|người thân|nguoi than|bố mẹ|ba mẹ|cha mẹ|bạn bè|ban be/i.test(
          queryAndContext
        ) ||
        /tang|qua|mung|tan gia|khai truong|sinh nhat|nguoi than|bo me|ba me|cha me|ban be/i.test(normQuery)
      ) {
        groupRegex = /HẠNH PHÚC|KIM NGÂN|KIM TIỀN|PHÁT TÀI|VẠN LỘC|NGỌC NGÂN|PHÚ QUÝ/i;
        groupQuery = "cay phong thuy";
      } else if (/để bàn|de ban|văn phòng|van phong|mini/i.test(queryAndContext) || /de ban|van phong|mini/i.test(normQuery)) {
        groupRegex = /KIM TIỀN|LƯỠI HỔ|KIM NGÂN|SEN ĐÁ|NGỌC NGÂN|PHÚ QUÝ|CẨM THẠCH/i;
        groupQuery = "cay de ban";
      } else if (/lọc không khí|loc khong khi|phong thủy|phong thuy|tài lộc|tai loc/i.test(queryAndContext) || /loc khong khi|phong thuy|tai loc/i.test(normQuery)) {
        groupRegex = /KIM TIỀN|KIM NGÂN|LƯỠI HỔ|HẠNH PHÚC|PHÁT TÀI/i;
        groupQuery = "cay loc khong khi";
      } else if (/đá mài|da mai|composite|xi măng|xi mang/i.test(queryAndContext) || /da mai|composite|xi mang/i.test(normQuery)) {
        groupRegex = /ĐÁ MÀI|COMPOSITE|XI MĂNG/i;
        groupQuery = "chau da mai";
      } else if (/chậu|chau/i.test(queryAndContext) || /chau/i.test(normQuery)) {
        groupRegex = /CHẬU/i;
        groupQuery = "chau cay";
      }

      if (groupRegex) {
        if (!searchLink && groupQuery) {
          searchLink = {
            label: "Xem tất cả",
            url: `/tim?q=${encodeURIComponent(groupQuery)}`,
            query: groupQuery,
          };
        }

        const groupDocs = await db
          .collection("aloha_products")
          .find(chatbotProductFilter({ ten: { $regex: groupRegex } }))
          .project({ ma: 1, ten: 1, giaBan: 1, images: 1, image: 1, ton: 1, webBadge: 1 })
          .limit(maxItems - cards.length + 4)
          .toArray();

        groupDocs.sort((a, b) => computeProductScore(b, context?.productCode) - computeProductScore(a, context?.productCode));

        for (const d of groupDocs) {
          if (cards.length >= maxItems) break;
          if (!seenCodes.has(d.ma)) {
            seenCodes.add(d.ma);
            cards.push(mapDocToProductCard(d));
          }
        }
      }
    } catch {
      // bỏ qua
    }
  }

  // 3. Fallback an toàn: nếu vẫn chưa có thẻ nào, lấy các mẫu cây để bàn bán chạy nhất
  if (cards.length === 0) {
    try {
      const popularDocs = await db
        .collection("aloha_products")
        .find(chatbotProductFilter({ ten: { $regex: /LƯỠI HỔ|KIM TIỀN|KIM NGÂN|SEN ĐÁ/i } }))
        .project({ ma: 1, ten: 1, giaBan: 1, images: 1, image: 1, ton: 1, webBadge: 1 })
        .limit(maxItems)
        .toArray();

      popularDocs.sort((a, b) => computeProductScore(b, context?.productCode) - computeProductScore(a, context?.productCode));

      for (const d of popularDocs) {
        if (!seenCodes.has(d.ma)) {
          seenCodes.add(d.ma);
          cards.push(mapDocToProductCard(d));
        }
      }
    } catch {
      // bỏ qua
    }
  }

  // 4. LUÔN ĐẢM BẢO CÓ SEARCHLINK KHI CÓ SẢN PHẨM GỢI Ý
  if (!searchLink && cards.length > 0) {
    const cleanKw = extractCleanKeywords(text);
    const queryTerm = cleanKw || "cay phong thuy";
    searchLink = {
      label: `Xem tất cả ${cleanKw || "sản phẩm"}`,
      url: `/tim?q=${encodeURIComponent(queryTerm)}`,
      query: queryTerm,
    };
  }

  return { cards, giftCard, searchLink };
}

async function lookupOrder(db: Db, text: string): Promise<OrderCard | null> {
  const match = text.match(ORDER_CODE_REGEX);
  if (!match) return null;
  const code = match[1].toUpperCase();

  try {
    const order: any = await db.collection("aloha_shop_orders").findOne({
      $or: [{ kvOrderCode: code }, { code: code }],
    });
    if (!order) return null;

    return {
      code: order.kvOrderCode || order.code,
      status: order.orderStatus || order.status || "",
      statusText: mapOrderStatusText(order.orderStatus || order.status || ""),
      total: Number(order.total || 0),
      receiver: order.customerName || "Quý khách",
      createdAt: order.createdAt ? new Date(order.createdAt).toLocaleDateString("vi-VN") : undefined,
    };
  } catch {
    return null;
  }
}

async function callGemini(
  systemInstruction: string,
  userPrompt: string,
  key: string
): Promise<string | null> {
  const configured = process.env.GEMINI_MODEL?.trim();
  const models = Array.from(
    new Set([
      configured || "gemini-flash-lite-latest",
      "gemini-flash-lite-latest",
      "gemini-3.8-flash",
      "gemma-4-26b-a4b-it",
      "gemma-4-31b-it",
      "gemini-3.6-flash",
    ])
  );

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2048, // Tăng lên 2048 tokens để tuyệt đối không bị cụt câu
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn(`[shopChatbot] Model ${model} returned ${res.status}: ${errText.slice(0, 150)}`);
        continue;
      }
      const data: any = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch (err: any) {
      console.warn(`[shopChatbot] Model ${model} fetch failed:`, err?.message, err?.cause || "");
    }
  }

  return null;
}

export function registerShopChatbotRoutes(app: Express, getDb: GetDb) {
  // CORS & OPTIONS
  app.options("/api/shop/ai-chat/message", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
  });

  app.post("/api/shop/ai-chat/message", async (req: Request, res: Response) => {
    try {
      if (!(await shopRateLimitOrReject(req, res, "shop_ai_chat", 20, 60_000))) {
        return;
      }

      const body = req.body || {};
      const rawMessages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
      const context: PageContext = body.context || {};

      const latestUserMessage = rawMessages
        .slice()
        .reverse()
        .find((m) => m && m.role === "user" && typeof m.content === "string")
        ?.content?.trim() || "";

      if (!latestUserMessage) {
        return res.status(400).json({ ok: false, error: "Vui lòng nhập câu hỏi." });
      }

      const db = await getDb();

      // 1. Kiểm tra mã đơn hàng
      const orderCard = await lookupOrder(db, latestUserMessage);

      // 2. Tìm kiếm sản phẩm phù hợp từ câu hỏi của khách & ngữ cảnh trang
      let productCards: ProductCard[] = [];
      let giftCard: GiftCard | undefined = undefined;
      let searchLink: SearchLink | undefined = undefined;

      const isProductQuery =
        Boolean(context.productName) ||
        /chậu|chau|cây|cay|mẫu|mau|giá|gia|bán|ban|sen đá|sen da|kim tiền|kim tien|lưỡi hổ|luoi ho|bàng|bang|monstera|hạnh phúc|hanh phuc|phát tài|phat tai|composite|đá mài|da mai|gốm|gom|sứ|su|để bàn|de ban|lọc không khí|loc khong khi|phong thủy|phong thuy|tư vấn|tu van|sản phẩm|san pham|mua|đặt|dat|quà|qua|tặng|tang|gia đình|gia dinh|người thương|nguoi thuong|bạn gái|ban gai|khai trương|khai truong|đồng nghiệp|dong nghiep|doanh nghiệp|doanh nghiep/i.test(
          latestUserMessage
        ) ||
        SPECIFIC_SPECIES_PATTERNS.some(
          (p) => p.match.test(latestUserMessage) || p.match.test(removeVietnameseTones(latestUserMessage))
        );

      if (isProductQuery && !orderCard) {
        const searchRes = await searchProductsByText(db, latestUserMessage, context, 4);
        productCards = searchRes.cards;
        giftCard = searchRes.giftCard;
        searchLink = searchRes.searchLink;
      }

      // 3. Chuẩn bị ngữ cảnh cho Gemini
      let contextAddition = "";
      if (context.productName) {
        contextAddition += `\n[KHÁCH ĐANG XEM SẢN PHẨM]: ${context.productName} (Mã: ${context.productCode || "N/A"}${context.productPrice ? `, Giá: ${context.productPrice.toLocaleString("vi-VN")}đ` : ""})`;
      }
      if (giftCard) {
        contextAddition += `\n[BỘ SƯU TẬP QUÀ TẶNG PHÙ HỢP]: ${giftCard.title} (${giftCard.tag}). Link: ${giftCard.url}. Giao diện đã tự động gắn thẻ bộ sưu tập này kèm nút bấm cho khách chuyển thẳng vào trang và lướt xuống xem sản phẩm.`;
      }
      if (orderCard) {
        contextAddition += `\n[THÔNG TIN ĐƠN HÀNG TRA CỨU ĐƯỢC]: Mã: ${orderCard.code}, Người nhận: ${orderCard.receiver}, Tổng tiền: ${orderCard.total.toLocaleString("vi-VN")}đ, Trạng thái: ${orderCard.statusText}, Ngày tạo: ${orderCard.createdAt || "Gần đây"}. Hãy tóm tắt lịch sự cho khách.`;
      }
      if (productCards.length > 0) {
        contextAddition += `\n[SẢN PHẨM CÙNG LOẠI CÓ SẴN TRONG KHO]: ${productCards.map((p) => `${p.ten} (Giá: ${p.giaBan.toLocaleString("vi-VN")}đ)`).join("; ")}. Hãy giới thiệu tự nhiên cho khách, giao diện web sẽ tự động hiển thị thanh trượt các mẫu này bên dưới tin nhắn.`;
      }

      const recentHistory = rawMessages
        .slice(-4)
        .map((m) => `${m.role === "user" ? "Khách" : "Aloha"}: ${m.content}`)
        .join("\n");

      const promptWithHistory = `LỊCH SỬ TRÒ CHUYỆN GẦN NHẤT:\n${recentHistory}\n${contextAddition}\n\nCÂU HỎI MỚI CỦA KHÁCH: "${latestUserMessage}"\n\nQUY TẮC TƯ VẤN (CHUẨN TONE OF VOICE HIỆN ĐẠI, THÂN THIỆN NHƯ CHUYÊN VIÊN LÀM VƯỜN TẬN TÂM):\n1. TUYỆT ĐỐI KHÔNG lặp lại câu chào hỏi rập khuôn máy móc như "Dạ em chào bạn", "Dạ Aloha chào bạn ạ", "Em xin tư vấn chi tiết về...". Hãy vào thẳng câu trả lời với sự niềm nở, tự nhiên và nhiệt tình.\n2. KHÔNG dùng tiêu đề biểu mẫu khô khan như "Thông tin & Đặc điểm nổi bật:".\n3. TRẢ LỜI CÔ ĐỌNG, DỄ ĐỌC (CẤU TRÚC 3 PHẦN):\n   - Mở đầu (1-2 câu): Nêu bật ấn tượng lớn nhất của sản phẩm (ví dụ: siêu dễ chăm, thanh lọc bức xạ máy tính, dáng gọn gàng...).\n   - Ý chính (Tối đa 3 gạch đầu dòng ngắn gọn với icon tinh tế 🌿, 💧, 🪴):\n     • 🌿 Ý nghĩa & vị trí đặt (phong thủy, góc làm việc, lọc khí).\n     • 💧 Chăm sóc (tần suất tưới bao nhiêu ngày/lần, ánh sáng phù hợp).\n     • 🪴 Dáng cây & chậu (chiều cao, đã trồng hoàn thiện hay cần lưu ý gì).\n   - Kết thúc (Gợi mở tiếp theo): Đặt 1 câu hỏi mở nhẹ nhàng để giúp khách chọn đúng gu (ví dụ: Bạn thích chậu sứ trắng thanh lịch hay xi măng mộc hơn?). Mời khách xem các mẫu cùng loại bên dưới hoặc nhắn Zalo 079 490 1233 để xem ảnh thực tế cây tại vườn trước khi giao.\n4. CỰC KỲ QUAN TRỌNG: Luôn viết câu hoàn chỉnh và trọn vẹn, kết thúc bằng dấu chấm, TUYỆT ĐỐI KHÔNG để lửng câu giữa chừng.`;

      const key = geminiKey();
      let aiReply: string | null = null;

      if (key) {
        aiReply = await callGemini(ALOHA_KNOWLEDGE, promptWithHistory, key);
      }

      // 4. Nếu AI trả lời có nhắc đến các cây/chậu khác mà chưa có thẻ sản phẩm -> bổ sung thêm thẻ sản phẩm từ nội dung AI
      if (aiReply && productCards.length === 0 && !giftCard && !orderCard) {
        const fallbackRes = await searchProductsByText(db, aiReply, context, 4);
        productCards = fallbackRes.cards;
        giftCard = fallbackRes.giftCard;
        searchLink = fallbackRes.searchLink;
      }

      // 5. Fallback nếu không có Gemini hoặc API bị nghẽn
      if (!aiReply) {
        if (orderCard) {
          aiReply = `Dạ Aloha đã kiểm tra đơn hàng **${orderCard.code}** của quý khách (${orderCard.receiver}):\n• Trạng thái: **${orderCard.statusText}**\n• Tổng thanh toán: **${orderCard.total.toLocaleString("vi-VN")}đ**\n\nNếu bạn cần hỗ trợ thêm hoặc muốn nhận ảnh thực tế cây trước khi giao, bạn nhắn Zalo 079 490 1233 nhé! 🌿`;
        } else if (giftCard) {
          aiReply = `Aloha có ngay bộ sưu tập **${giftCard.title}** (${giftCard.tag}) cực kỳ trang trọng và ý nghĩa dành cho bạn! ✨\n\nBạn có thể bấm vào thẻ bên dưới để xem bộ sưu tập và chọn chậu cây ưng ý nhất, Aloha có thể chuẩn bị thiệp viết tay theo lời chúc của bạn và gửi ảnh duyệt cây trước qua Zalo 079 490 1233 nha 🌿.`;
        } else if (productCards.length > 0) {
          const isGift =
            /tặng|tang|quà|qua|mừng|mung|tân gia|tan gia|khai trương|khai truong|sinh nhật|sinh nhat|người thân|nguoi than|bố mẹ|ba mẹ|bạn bè/i.test(
              latestUserMessage
            );
          if (isGift) {
            aiReply = `Tặng cây xanh cho người thân là một món quà cực kỳ ý nghĩa và tinh tế bạn nhé! ✨\n\nTuỳ vào dịp và sở thích của người nhận, Aloha gợi ý bạn các dòng cây mang năng lượng may mắn nhất:\n• 🌿 **Cây Hạnh Phúc / Kim Ngân:** Tượng trưng cho gia đình hòa thuận, bình an và thu hút tài lộc.\n• 🪴 **Cây Kim Tiền / Vạn Lộc:** Lời chúc thịnh vượng, hanh thông và phát tài.\n• 💧 **Cây Lưỡi Hổ / Lan Chi:** Siêu dễ chăm sóc, thanh lọc không khí cực tốt cho góc làm việc và phòng khách.\n\nBạn dự định tặng người thân nhân dịp gì (tân gia, sinh nhật hay quà tặng bất ngờ) để em chọn dáng chậu trang trọng nhất cho bạn nhé? Hoặc bạn có thể nhắn Zalo 079 490 1233 để em gửi ảnh góc thật của từng cây tại vườn nha 🌿.`;
          } else {
            aiReply = `Aloha xin gửi bạn một số mẫu cây đang rất tươi tốt và được ưa chuộng tại vườn nhé! ✨\n\nBạn có thể lướt xem các mẫu bên dưới, hoặc nhắn Zalo 079 490 1233 để bên em chụp ảnh góc thật của từng cây cho bạn duyệt ưng ý trước khi giao nha 🌿.`;
          }
        } else {
          aiReply = `Aloha Thế Giới Chậu Cây luôn sẵn sàng hỗ trợ bạn! 🌿\n• Showroom & Vườn: 90/2 Nguyễn Phúc Chu, P.15, Tân Bình, TP.HCM (08:00 - 20:00)\n• Hotline / Zalo: 079 490 1233\n\nBạn đang tìm mẫu cây để bàn, cây đặt sàn hay mẫu chậu ban công cứ nhắn em tư vấn kỹ hơn nhé!`;
        }
      }

      return res.json({
        ok: true,
        reply: aiReply,
        productCards: productCards.length > 0 ? productCards : undefined,
        giftCard: giftCard || undefined,
        searchLink: searchLink || undefined,
        orderCard: orderCard || undefined,
      });
    } catch (e: any) {
      console.error("[shop/ai-chat/message]", e);
      return res.status(500).json({
        ok: false,
        error: "Hệ thống tư vấn đang bận. Bạn vui lòng nhắn Zalo 079 490 1233 để được hỗ trợ ngay nhé!",
      });
    }
  });
}
