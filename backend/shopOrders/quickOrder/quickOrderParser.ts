import type { Db } from "mongodb";
import { geminiKey, generateText, type GeminiContent } from "../../plantDoctor/gemini.js";
import { publicPrice } from "../../shopCatalog/priceOverlay.js";
import { publicTon } from "../../shopCatalog/catalog/publicProduct.js";
import { resolveGhnLocation } from "../../shopShipping/locationCache.js";
import type {
  QuickOrderParseInput,
  QuickOrderParseResult,
  QuickOrderItem,
  QuickOrderParsedCustomer,
  QuickOrderCandidate,
  QuickOrderVisualAnalysis,
} from "./quickOrderTypes.js";

const PROD_COL = "aloha_products";

function normVi(str: string): string {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .trim();
}

/** Tách từ khóa tìm kiếm có ý nghĩa */
function extractKeywords(query: string): string[] {
  const norm = normVi(query);
  return norm
    .split(/[\s,;+.\-_/|\\()]+/g)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !/^(cho|va|voi|cai|chiec|lay|mua|gui|em|anh|chi|shop|nhe|gium|nha)$/i.test(w));
}

/** Chấm điểm độ khớp giữa từ khóa người dùng và tên sản phẩm */
function scoreProductMatch(query: string, prodName: string, prodCode: string): number {
  const normQ = normVi(query);
  const normName = normVi(prodName);
  const normCode = normVi(prodCode);

  if (normCode && (normQ === normCode || normQ.includes(normCode))) return 100;
  if (normName === normQ) return 95;
  if (normName.includes(normQ)) return 85;

  const qWords = extractKeywords(query);
  if (!qWords.length) return 0;

  let score = 0;
  const nameWords = new Set(extractKeywords(prodName));

  for (const w of qWords) {
    if (nameWords.has(w)) {
      score += 15;
    } else if (normName.includes(w)) {
      score += 8;
    }
    // Ưu tiên khớp kích thước số đo (VD: 60x20x20, 30cm, 5kg)
    if (/\d+(x\d+|cm|m|kg|g|lit|l)/i.test(w) && normName.includes(w)) {
      score += 25;
    }
  }

  return score;
}

/** Tìm sản phẩm phù hợp nhất trong kho aloha_products */
async function matchProduct(
  db: Db,
  query: string,
  quantity: number = 1
): Promise<QuickOrderItem | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const col = db.collection(PROD_COL);
  const keywords = extractKeywords(trimmed);

  // 1. Tìm trực tiếp theo mã sản phẩm
  const exactCode = await col.findOne({
    $or: [
      { ma: { $regex: `^${trimmed}$`, $options: "i" } },
      { maHang: { $regex: `^${trimmed}$`, $options: "i" } },
    ],
    deletedAt: null,
  });
  if (exactCode) {
    return {
      productCode: String(exactCode.ma || exactCode.maHang || ""),
      productName: String(exactCode.ten || exactCode.name || ""),
      quantity: Math.max(1, Math.round(quantity)),
      price: publicPrice(exactCode),
      originalPrice: Number(exactCode.basePrice || exactCode.giaChung || exactCode.giaBan || 0),
      stock: publicTon(exactCode),
      imageUrl: Array.isArray(exactCode.images) && exactCode.images[0] ? exactCode.images[0] : "",
      confidence: 100,
      rawQuery: query,
    };
  }

  // 2. Tìm theo từ khóa trong tên
  const searchRegexes = keywords.slice(0, 4).map((kw) => ({
    ten: { $regex: kw, $options: "i" },
  }));

  const queryFilter: Record<string, unknown> = { deletedAt: null };
  if (searchRegexes.length > 0) {
    queryFilter.$or = searchRegexes;
  }

  const candidates = await col
    .find(queryFilter)
    .project({
      ma: 1,
      maHang: 1,
      ten: 1,
      name: 1,
      giaWeb: 1,
      giaBan: 1,
      giaChung: 1,
      basePrice: 1,
      priceBooks: 1,
      tonKho: 1,
      onHand: 1,
      kvTon: 1,
      images: 1,
    })
    .limit(30)
    .toArray();

  if (!candidates.length) return null;

  let bestDoc: any = null;
  let bestScore = 0;

  for (const c of candidates) {
    const sc = scoreProductMatch(trimmed, String(c.ten || c.name || ""), String(c.ma || c.maHang || ""));
    if (sc > bestScore) {
      bestScore = sc;
      bestDoc = c;
    }
  }

  if (!bestDoc || bestScore < 15) return null;

  return {
    productCode: String(bestDoc.ma || bestDoc.maHang || ""),
    productName: String(bestDoc.ten || bestDoc.name || ""),
    quantity: Math.max(1, Math.round(quantity)),
    price: publicPrice(bestDoc),
    originalPrice: Number(bestDoc.basePrice || bestDoc.giaChung || bestDoc.giaBan || 0),
    stock: publicTon(bestDoc),
    imageUrl: Array.isArray(bestDoc.images) && bestDoc.images[0] ? bestDoc.images[0] : "",
    confidence: bestScore,
    rawQuery: query,
  };
}

/** Fallback regex khi không có AI hoặc Gemini gặp lỗi mạng */
function parseByRegex(text: string): {
  customer: Partial<QuickOrderParsedCustomer>;
  rawItems: { query: string; quantity: number }[];
  note: string;
} {
  const phoneMatch = text.match(/(?:\+84|0)(?:3|5|7|8|9)\d{8}/);
  const phone = phoneMatch ? phoneMatch[0].replace(/^\+84/, "0") : "";

  // Tách tên nếu có cụm từ "tên:", "người nhận:", "anh", "chị", "khách:", "kh:"
  let name = "";
  const nameMatch = text.match(/(?:người nhận|tên|khách|kh|anh|chị)\s*[:\-]?\s*(?:kh\s+|anh\s+|chị\s+)?([A-ZÀ-Ỹa-zà-ỹ\s]{2,25})(?:,|-|\n|\d|$)/i);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].replace(/^(kh|anh|chị|em|bác|chú|cô)\s+/i, "").trim();
  }

  // Tách địa chỉ (hỗ trợ cả đ/c, đc, địa chỉ, giao về...)
  let address = "";
  const addrMatch = text.match(/(?:địa chỉ|giao về|ship về|về|đ\/c|đc)\s*[:\-]?\s*([^\n\r]+)/i);
  if (addrMatch && addrMatch[1]) {
    address = addrMatch[1].trim();
  }

  // Tách ghi chú / cọc
  const notes: string[] = [];
  const cocMatch = text.match(/(?:đã cọc|cọc|đặt cọc)\s*[:\-]?\s*([^\n\r,;]+)/i);
  if (cocMatch) notes.push(cocMatch[0].trim());
  const giaoMatch = text.match(/(?:giao trong ngày|giao gấp|hỏa tốc|ship chiều|ship sáng|sau \d+h)/i);
  if (giaoMatch) notes.push(giaoMatch[0].trim());

  // Tách sản phẩm bằng regex nếu có cụm từ "lấy...", "mua...", "gửi..."
  const rawItems: { query: string; quantity: number }[] = [];
  const itemMatch = text.match(/(?:lấy|mua|gửi|cho|chốt)\s+(?:(\d+)\s+)?([^\.,;\n]+?)(?=\s+(?:về|địa chỉ|sđt|giao|ship|cho anh|cho chị|$))/i);
  if (itemMatch && itemMatch[2]) {
    const q = Number(itemMatch[1]) || 1;
    rawItems.push({ query: itemMatch[2].trim(), quantity: q });
  } else if (!phone && !name && text.trim().length > 3) {
    // Nếu đoạn chat chỉ là tên món hàng đơn thuần
    rawItems.push({ query: text.trim(), quantity: 1 });
  }

  return {
    customer: { name, phone, address, fullAddress: address } as any,
    rawItems,
    note: notes.join(". "),
  };
}

const AI_SYSTEM_PROMPT = `Bạn là trợ lý bóc tách đơn hàng thông minh của cửa hàng Aloha Shop (chuyên cây cảnh, chậu đá mài, chậu xi măng, đất trồng, phân bón).
Nhiệm vụ: Trích xuất thông tin khách hàng và danh sách sản phẩm từ tin nhắn chat hoặc hình ảnh đơn hàng của khách.

Quy tắc trích xuất:
1. customer:
   - name: Họ và tên người nhận. Bỏ các tiền tố xưng hô như "Anh/Chị/Em/Shop/Khách/KH" nếu có, chỉ lấy tên ngắn gọn.
   - phone: Số điện thoại (10 số dạng 0xxxxxxxxx). Nếu có +84 chuyển thành 0.
   - street: Số nhà, ngõ/ngách, tên đường hoặc thôn xóm.
   - ward: Phường / Xã / Thị trấn (chuẩn hóa tên, ví dụ "Phường Vĩnh Hải", "P. Linh Trung").
   - district: Quận / Huyện / Thị xã / TP trực thuộc tỉnh (ví dụ "TP. Nha Trang", "Quận 1", "TP. Thủ Đức").
   - province: Tỉnh hoặc Thành phố trực thuộc TW. Tự động suy ra tỉnh nếu khách chỉ ghi tên thành phố (ví dụ: "Nha Trang" -> "Khánh Hòa", "Đà Lạt" -> "Lâm Đồng", "Vũng Tàu" -> "Bà Rịa - Vũng Tàu", "Quy Nhơn" -> "Bình Định", "Buôn Ma Thuột" -> "Đắk Lắk", "Thủ Đức/Quận 1" -> "TP. Hồ Chí Minh", "Cầu Giấy/Đống Đa" -> "Hà Nội").
   - fullAddress: Ghép đầy đủ địa chỉ từ số nhà tới tỉnh thành.
2. items: Mảng các sản phẩm khách muốn mua:
   - Nếu khách CÓ GHI rõ tên sản phẩm bằng chữ trong tin nhắn (ví dụ: "lấy 2 chậu đá mài 60x20", "1 bao đất"): trích xuất vào items.
   - Nếu khách CHỈ GỬI ẢNH cây/chậu và KHÔNG đề cập tên sản phẩm trong chữ (chỉ gửi địa chỉ/sđt/cọc): ĐỂ MẢNG items LÀ [] để hệ thống tự động tìm đúng cây trong ảnh từ kho Aloha.
3. visualAnalysis (Quan trọng khi có ảnh cây cảnh / chậu):
   - plantName: Tên loại cây chính trong ảnh (VD: Cần Thăng, Cẩm Thị, Kim Tiền, Lưỡi Hổ...). Tối đa 5 từ.
   - potType: Dáng chậu, chất liệu, màu chậu (VD: Chậu sứ trắng chữ nhật bo góc). Tối đa 10 từ. TUYỆT ĐỐI không viết câu dài lan man, không chúc tụng phong thủy.
   - accessories: Mảng các phụ kiện/cây phối kèm (VD: ["mèo thần tài", "cẩm nhung"]). Tối đa 3 phụ kiện.
   - keywords: Mảng 3-5 từ khóa tìm kiếm tiếng Việt tốt nhất để tìm cây này trong kho Aloha (VD: ["thành phẩm cần thăng", "cần thăng phát tài", "tiểu cảnh cần thăng", "cần thăng gốc thụ"]).
4. note: Các yêu cầu đặc biệt của khách (ví dụ: "đã cọc 500k", "giao trong ngày", "ship buổi chiều").

LƯU Ý CỰC KỲ QUAN TRỌNG:
- Mọi giá trị chuỗi trả về (name, street, ward, district, province, plantName, potType) CHỈ CHỨA DUY NHẤT TÊN THỰC TẾ NGẮN GỌN (dưới 5 từ).
- TUYỆT ĐỐI KHÔNG giải thích, KHÔNG viết lý do, KHÔNG dùng dấu gạch chéo (/) để liệt kê nhiều phương án trong giá trị chuỗi.`;

const AI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    customer: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        phone: { type: "STRING" },
        street: { type: "STRING" },
        ward: { type: "STRING" },
        district: { type: "STRING" },
        province: { type: "STRING" },
        fullAddress: { type: "STRING" },
      },
    },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING" },
          quantity: { type: "INTEGER" },
        },
      },
    },
    visualAnalysis: {
      type: "OBJECT",
      properties: {
        plantName: { type: "STRING" },
        potType: { type: "STRING" },
        accessories: { type: "ARRAY", items: { type: "STRING" } },
        keywords: { type: "ARRAY", items: { type: "STRING" } },
      },
    },
    note: { type: "STRING" },
  },
};

/**
 * Tìm kiếm Top sản phẩm tương đồng nhất từ đặc trưng ảnh nhận diện được
 */
async function findImageVisualCandidates(
  db: Db,
  analysis: QuickOrderVisualAnalysis
): Promise<QuickOrderCandidate[]> {
  const col = db.collection(PROD_COL);
  const keywords = [
    ...(analysis.keywords || []),
    analysis.plantName || "",
    ...(analysis.accessories || []),
  ]
    .map((k) => normVi(k))
    .filter(Boolean);

  if (!keywords.length) return [];

  const orConditions: any[] = [];
  for (const kw of keywords.slice(0, 5)) {
    const clean = kw.replace(/[^a-z0-9\s]/g, "").trim();
    if (clean.length > 2) {
      orConditions.push({ ten: { $regex: clean, $options: "i" } });
    }
  }

  orConditions.push({ ten: { $regex: "thành phẩm", $options: "i" } });
  orConditions.push({ ten: { $regex: "tiểu cảnh", $options: "i" } });

  const docs = await col
    .find({
      $or: orConditions,
      deletedAt: null,
    })
    .project({
      ma: 1,
      maHang: 1,
      ten: 1,
      name: 1,
      giaWeb: 1,
      giaBan: 1,
      giaChung: 1,
      basePrice: 1,
      priceBooks: 1,
      tonKho: 1,
      onHand: 1,
      kvTon: 1,
      images: 1,
      nhom: 1,
      nhomPath: 1,
    })
    .limit(40)
    .toArray();

  const plantNameNorm = normVi(analysis.plantName || "");
  const accessoriesNorm = (analysis.accessories || []).map((a) => normVi(a));

  const scored = docs.map((d: any) => {
    const tenNorm = normVi(d.ten || d.name || "");
    let score = 0;
    const reasons: string[] = [];

    // Khớp loại cây chính
    if (plantNameNorm && tenNorm.includes(plantNameNorm)) {
      score += 45;
      reasons.push(`Khớp loại cây: ${analysis.plantName}`);
    } else if (
      (plantNameNorm.includes("can thang") || plantNameNorm.includes("cam thi")) &&
      (tenNorm.includes("can thang") || tenNorm.includes("goc thu") || tenNorm.includes("cam thi"))
    ) {
      score += 45;
      reasons.push("Khớp cây Cần Thăng / Cẩm Thị bonsai");
    }

    // Khớp dòng Thành phẩm / Tiểu cảnh
    if (tenNorm.includes("thanh pham") || tenNorm.includes("tieu canh") || tenNorm.includes("combo")) {
      score += 25;
      reasons.push("Dòng Cây thành phẩm / Tiểu cảnh trồng sẵn");
    }

    // Khớp phụ kiện
    for (const acc of accessoriesNorm) {
      if (acc && tenNorm.includes(acc)) {
        score += 20;
        reasons.push(`Phối phụ kiện: ${acc}`);
        break;
      }
    }
    if (
      tenNorm.includes("phat tai") ||
      tenNorm.includes("cat tuong") ||
      tenNorm.includes("binh an") ||
      tenNorm.includes("may man")
    ) {
      score += 15;
      reasons.push("Tên mang ý nghĩa phong thủy / may mắn");
    }

    if (Array.isArray(d.images) && d.images.length > 0) {
      score += 10;
    }

    return {
      productCode: String(d.ma || d.maHang || ""),
      productName: String(d.ten || d.name || ""),
      quantity: 1,
      price: publicPrice(d), // Mặc định GIÁ WEB
      originalPrice: Number(d.basePrice || d.giaChung || d.giaBan || 0),
      stock: publicTon(d),
      imageUrl: Array.isArray(d.images) && d.images[0] ? d.images[0] : "",
      confidence: Math.min(99, Math.max(30, score)),
      matchReasons: reasons.length ? reasons : ["Gợi ý từ hình ảnh"],
    };
  });

  scored.sort((a, b) => b.confidence - a.confidence);
  const seen = new Set<string>();
  const uniq: QuickOrderCandidate[] = [];
  for (const s of scored) {
    if (!seen.has(s.productCode)) {
      seen.add(s.productCode);
      uniq.push(s);
      if (uniq.length >= 4) break;
    }
  }

  return uniq;
}

/**
 * Xử lý bóc tách thông tin từ Text hoặc Hình ảnh
 */
export async function parseQuickOrder(
  db: Db,
  input: QuickOrderParseInput
): Promise<QuickOrderParseResult> {
  const text = String(input.text || "").trim();
  const hasImage = Boolean(input.imageBase64);
  const key = geminiKey();

  let parsedData: {
    customer: Partial<QuickOrderParsedCustomer>;
    items: { query: string; quantity: number }[];
    visualAnalysis?: QuickOrderVisualAnalysis;
    note: string;
  } = {
    customer: {},
    items: [],
    note: "",
  };

  // 1. Thử gọi AI Gemini (hỗ trợ cả chữ lẫn hình ảnh)
  if (key && (text || hasImage)) {
    try {
      const parts: any[] = [];
      if (text) {
        parts.push({ text: `Đoạn chat đơn hàng của khách:\n${text}` });
      }
      if (hasImage) {
        parts.push({
          inlineData: {
            mimeType: input.imageMime || "image/jpeg",
            data: input.imageBase64!,
          },
        });
        if (!text) {
          parts.push({ text: "Hãy đọc ảnh trên (ảnh chụp màn hình tin nhắn hoặc sổ đơn/sản phẩm) và bóc tách đơn hàng." });
        }
      }

      const contents: GeminiContent[] = [{ role: "user", parts }];
      const aiJson = await generateText(key, AI_SYSTEM_PROMPT, contents, 3072, AI_RESPONSE_SCHEMA);

      if (aiJson) {
        let cleaned = aiJson.replace(/```json/gi, "").replace(/```/g, "").trim();
        let obj: any = null;
        try {
          obj = JSON.parse(cleaned);
        } catch {
          const lastClose = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
          if (lastClose > 0) {
            try {
              obj = JSON.parse(cleaned.slice(0, lastClose + 1));
            } catch {
              try {
                obj = JSON.parse(cleaned.slice(0, lastClose + 1) + "}");
              } catch {}
            }
          }
        }

        if (obj && typeof obj === "object") {
          let vis: QuickOrderVisualAnalysis | undefined = undefined;
          if (obj.visualAnalysis && typeof obj.visualAnalysis === "object") {
            vis = {
              plantName: String(obj.visualAnalysis.plantName || "").slice(0, 50).trim(),
              potType: String(obj.visualAnalysis.potType || "").slice(0, 80).trim(),
              accessories: Array.isArray(obj.visualAnalysis.accessories)
                ? obj.visualAnalysis.accessories
                    .slice(0, 4)
                    .map((a: any) => String(a || "").slice(0, 30).trim())
                    .filter(Boolean)
                : [],
              keywords: Array.isArray(obj.visualAnalysis.keywords)
                ? obj.visualAnalysis.keywords
                    .slice(0, 5)
                    .map((k: any) => String(k || "").slice(0, 30).trim())
                    .filter(Boolean)
                : [],
            };
          }
          parsedData = {
            customer: obj.customer || {},
            items: Array.isArray(obj.items) ? obj.items : [],
            visualAnalysis: vis,
            note: String(obj.note || ""),
          };
        }
      }
    } catch (e: any) {
      console.warn("[QuickOrder] AI parse warning:", e?.message || e);
    }
  }

  // 2. Fallback sang Regex nếu AI chưa bóc được tên/sđt/note và có đoạn text
  if (text) {
    const rx = parseByRegex(text);
    if (!parsedData.customer.phone) {
      parsedData.customer = { ...rx.customer, ...parsedData.customer };
    }
    if (!parsedData.items.length && rx.rawItems.length) {
      parsedData.items = rx.rawItems;
    }
    if (!parsedData.note && rx.note) {
      parsedData.note = rx.note;
    }
  }

  // 3. Chuẩn hóa địa chỉ và khớp GHN Master Data
  const c = parsedData.customer;
  const cleanLocField = (s: any) =>
    String(s || "")
      .split(/[\/,;]|nhưng|lấy|chuẩn|hoặc|v\.v/i)[0]
      .replace(/[\r\n\t]+/g, " ")
      .trim();

  let prov = cleanLocField(c.province);
  let dist = cleanLocField(c.district);
  let ward = cleanLocField(c.ward);
  let street = cleanLocField(c.street);
  const rawAddr = String(c.fullAddress || c.address || "").trim();

  let ghnDistrictId: number | undefined;
  let ghnWardCode: string | undefined;

  if (prov || dist || ward || rawAddr) {
    try {
      const ghnMatch = await resolveGhnLocation(prov, dist || rawAddr, ward);
      if (ghnMatch) {
        if (ghnMatch.provinceName) prov = ghnMatch.provinceName;
        if (ghnMatch.districtName) dist = ghnMatch.districtName;
        if (ghnMatch.wardName) ward = ghnMatch.wardName;
        ghnDistrictId = ghnMatch.districtId || undefined;
        ghnWardCode = ghnMatch.wardCode || undefined;

        // Nếu chưa có số nhà/tên đường (street) mà có địa chỉ thô, bóc tách street
        if (!street && rawAddr) {
          let st = rawAddr;
          if (dist) st = st.replace(new RegExp(dist.replace(/^(thành phố|tp\.?|quận|huyện)\s+/i, ""), "gi"), "");
          if (ward) st = st.replace(new RegExp(ward.replace(/^(phường|xã|thị trấn)\s+/i, ""), "gi"), "");
          if (prov) st = st.replace(new RegExp(prov.replace(/^(tỉnh|thành phố)\s+/i, ""), "gi"), "");
          st = st.replace(/[\s,.\-_/]+$/g, "").replace(/^[\s,.\-_/]+/g, "").trim();
          if (st.length > 2) street = st;
        }
      }
    } catch (e) {
      /* ignore GHN lookup errors */
    }
  }

  const fullAddr =
    (street && ward && dist && prov ? `${street}, ${ward}, ${dist}, ${prov}` : null) ||
    [street, ward, dist, prov].filter(Boolean).join(", ") ||
    rawAddr ||
    text;

  const normalizedCustomer: QuickOrderParsedCustomer = {
    name: String(c.name || "").trim(),
    phone: String(c.phone || "").trim(),
    street,
    ward,
    district: dist,
    province: prov,
    address: fullAddr,
    fullAddress: fullAddr,
    ghnDistrictId,
    ghnWardCode,
  };

  // 4. Khớp sản phẩm với kho Aloha (lấy giá mặc định là Giá Web)
  const matchedItems: QuickOrderItem[] = [];
  const unmatchedItems: string[] = [];

  for (const it of parsedData.items) {
    const query = String(it.query || "").trim();
    if (!query) continue;
    const match = await matchProduct(db, query, it.quantity || 1);
    if (match) {
      matchedItems.push(match);
    } else {
      unmatchedItems.push(query);
    }
  }

  // 5. Nếu có ảnh -> Tìm Top sản phẩm tương đồng nhất trong kho Aloha
  let candidates: QuickOrderCandidate[] = [];
  if (hasImage) {
    try {
      const visInput: QuickOrderVisualAnalysis = parsedData.visualAnalysis || {
        plantName: "Cần Thăng",
        potType: "Chậu bonsai",
        accessories: [],
        keywords: ["cần thăng", "thành phẩm", "tiểu cảnh", "cát tường", "phát tài"],
      };
      candidates = await findImageVisualCandidates(db, visInput);
    } catch (e) {
      console.warn("[QuickOrder] Visual candidate search warning:", e);
    }
  }

  // Nếu có ảnh và danh sách matchedItems rỗng HOẶC chỉ match các từ suy diễn điểm thấp (< 60):
  // Tự động gán ứng viên ảnh hàng đầu #1 vào đơn với Giá Web
  if (candidates.length > 0) {
    const hasSolidItem = matchedItems.some((it) => (it.confidence || 0) >= 60);
    if (!hasSolidItem) {
      const top = candidates[0];
      matchedItems.length = 0; // Xóa item điểm thấp nhầm lẫn (ví dụ Cầu thang đá tầng)
      matchedItems.push({
        productCode: top.productCode,
        productName: top.productName,
        quantity: 1,
        price: top.price,
        originalPrice: top.originalPrice,
        stock: top.stock,
        imageUrl: top.imageUrl,
        confidence: top.confidence,
      });
    }
  }

  return {
    customer: normalizedCustomer,
    items: matchedItems,
    candidates: candidates.length ? candidates : undefined,
    visualAnalysis: parsedData.visualAnalysis,
    unmatchedItems: unmatchedItems.length ? unmatchedItems : undefined,
    note: parsedData.note || "",
    rawText: text,
  };
}
