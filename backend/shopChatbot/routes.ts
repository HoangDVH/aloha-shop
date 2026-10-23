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

const SPECIFIC_SPECIES_PATTERNS = [
  { match: /lưỡi hổ/i, regex: /LƯỠI HỔ/i, label: "Lưỡi Hổ" },
  { match: /kim tiền/i, regex: /KIM TIỀN/i, label: "Kim Tiền" },
  { match: /kim ngân/i, regex: /KIM NGÂN/i, label: "Kim Ngân" },
  { match: /sen đá/i, regex: /SEN ĐÁ/i, label: "Sen Đá" },
  { match: /xương rồng/i, regex: /XƯƠNG RỒNG/i, label: "Xương Rồng" },
  { match: /trầu bà/i, regex: /TRẦU BÀ/i, label: "Trầu Bà" },
  { match: /monstera|nam mỹ/i, regex: /MONSTERA|NAM MỸ/i, label: "Monstera" },
  { match: /bàng/i, regex: /BÀNG/i, label: "Bàng Singapore" },
  { match: /hạnh phúc/i, regex: /HẠNH PHÚC/i, label: "Hạnh Phúc" },
  { match: /phát tài/i, regex: /PHÁT TÀI/i, label: "Phát Tài" },
  { match: /ngọc ngân/i, regex: /NGỌC NGÂN/i, label: "Ngọc Ngân" },
  { match: /phú quý/i, regex: /PHÚ QUÝ/i, label: "Phú Quý" },
  { match: /trúc bách hợp/i, regex: /TRÚC BÁCH HỢP/i, label: "Trúc Bách Hợp" },
  { match: /lan chi/i, regex: /LAN CHI/i, label: "Lan Chi" },
  { match: /vạn lộc/i, regex: /VẠN LỘC/i, label: "Vạn Lộc" },
  { match: /đá mài/i, regex: /ĐÁ MÀI/i, label: "Chậu Đá Mài" },
  { match: /composite/i, regex: /COMPOSITE/i, label: "Chậu Composite" },
  { match: /xi măng/i, regex: /XI MĂNG/i, label: "Chậu Xi Măng" },
  { match: /gốm sứ|men sứ|chậu gốm/i, regex: /GỐM|SỨ/i, label: "Chậu Gốm Sứ" },
  { match: /đất nung/i, regex: /ĐẤT NUNG/i, label: "Chậu Đất Nung" },
  { match: /đôn/i, regex: /ĐÔN/i, label: "Đôn Kê Chậu" },
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

async function searchProductsByText(
  db: Db,
  text: string,
  context?: PageContext,
  maxItems = 4
): Promise<ProductCard[]> {
  const cards: ProductCard[] = [];
  const seenCodes = new Set<string>();

  const queryAndContext = `${text} ${context?.productName || ""}`;

  // 1. Nhận diện chủng loại cụ thể (Species/Family) để gợi ý CÙNG LOẠI
  const matchedSpecies = SPECIFIC_SPECIES_PATTERNS.find((p) => p.match.test(queryAndContext));

  if (matchedSpecies) {
    try {
      const speciesDocs = await db
        .collection("aloha_products")
        .find({
          ten: { $regex: matchedSpecies.regex },
          giaBan: { $gt: 0 },
          hienThiWeb: { $ne: false },
          images: { $exists: true, $type: "array", $ne: [] },
        })
        .project({ ma: 1, ten: 1, giaBan: 1, images: 1, image: 1, categoryName: 1 })
        .limit(maxItems + 3)
        .toArray();

      // Nếu khách đang xem 1 mã cụ thể, ưu tiên đưa các mã khác cùng loại lên trước để gợi ý đa dạng
      const sortedDocs = context?.productCode
        ? [
            ...speciesDocs.filter((d) => d.ma !== context.productCode),
            ...speciesDocs.filter((d) => d.ma === context.productCode),
          ]
        : speciesDocs;

      for (const d of sortedDocs) {
        if (cards.length >= maxItems) break;
        if (!seenCodes.has(d.ma)) {
          seenCodes.add(d.ma);
          cards.push({
            ma: d.ma,
            ten: d.ten,
            giaBan: Number(d.giaBan || 0),
            image: Array.isArray(d.images) && d.images[0] ? d.images[0] : d.image || undefined,
            url: `/sp/${encodeURIComponent(d.ma)}`,
          });
        }
      }

      // Nếu đã tìm được ít nhất 2 mẫu cùng loại -> trả về ngay, không bao giờ lấy lạc sang loại khác
      if (cards.length >= 2) {
        return cards;
      }

      // Nếu chỉ có 1 mẫu, tìm thêm các sản phẩm CÙNG DANH MỤC (categoryName) của sản phẩm đó
      if (cards.length > 0 && speciesDocs[0]?.categoryName) {
        const catDocs = await db
          .collection("aloha_products")
          .find({
            categoryName: speciesDocs[0].categoryName,
            giaBan: { $gt: 0 },
            hienThiWeb: { $ne: false },
            images: { $exists: true, $type: "array", $ne: [] },
          })
          .project({ ma: 1, ten: 1, giaBan: 1, images: 1, image: 1 })
          .limit(maxItems - cards.length + 2)
          .toArray();

        for (const d of catDocs) {
          if (cards.length >= maxItems) break;
          if (!seenCodes.has(d.ma)) {
            seenCodes.add(d.ma);
            cards.push({
              ma: d.ma,
              ten: d.ten,
              giaBan: Number(d.giaBan || 0),
              image: Array.isArray(d.images) && d.images[0] ? d.images[0] : d.image || undefined,
              url: `/sp/${encodeURIComponent(d.ma)}`,
            });
          }
        }
        return cards;
      }
    } catch {
      // bỏ qua
    }
  }

  // 2. Nếu không tìm thấy loại cây cụ thể -> Tìm theo nhóm nhu cầu lớn (quà tặng, để bàn, chậu, lọc không khí...)
  if (cards.length < maxItems) {
    try {
      let groupRegex: RegExp | null = null;
      if (
        /tặng|tang|quà|qua|mừng|mung|tân gia|tan gia|khai trương|khai truong|sinh nhật|sinh nhat|người thân|nguoi than|bố mẹ|ba mẹ|cha mẹ|bạn bè|ban be/i.test(
          queryAndContext
        )
      ) {
        groupRegex = /HẠNH PHÚC|KIM NGÂN|KIM TIỀN|PHÁT TÀI|VẠN LỘC|NGỌC NGÂN|PHÚ QUÝ/i;
      } else if (/để bàn|văn phòng|mini/i.test(queryAndContext)) {
        groupRegex = /KIM TIỀN|LƯỠI HỔ|KIM NGÂN|SEN ĐÁ|NGỌC NGÂN|PHÚ QUÝ|CẨM THẠCH/i;
      } else if (/lọc không khí|phong thủy|tài lộc/i.test(queryAndContext)) {
        groupRegex = /KIM TIỀN|KIM NGÂN|LƯỠI HỔ|HẠNH PHÚC|PHÁT TÀI/i;
      } else if (/đá mài|composite|xi măng/i.test(queryAndContext)) {
        groupRegex = /ĐÁ MÀI|COMPOSITE|XI MĂNG/i;
      } else if (/chậu/i.test(queryAndContext)) {
        groupRegex = /CHẬU/i;
      }

      if (groupRegex) {
        const groupDocs = await db
          .collection("aloha_products")
          .find({
            ten: { $regex: groupRegex },
            giaBan: { $gt: 0 },
            hienThiWeb: { $ne: false },
            images: { $exists: true, $type: "array", $ne: [] },
          })
          .project({ ma: 1, ten: 1, giaBan: 1, images: 1, image: 1 })
          .limit(maxItems - cards.length)
          .toArray();

        for (const d of groupDocs) {
          if (!seenCodes.has(d.ma)) {
            seenCodes.add(d.ma);
            cards.push({
              ma: d.ma,
              ten: d.ten,
              giaBan: Number(d.giaBan || 0),
              image: Array.isArray(d.images) && d.images[0] ? d.images[0] : d.image || undefined,
              url: `/sp/${encodeURIComponent(d.ma)}`,
            });
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
        .find({
          ten: { $regex: /LƯỠI HỔ|KIM TIỀN|KIM NGÂN|SEN ĐÁ/i },
          giaBan: { $gt: 0 },
          hienThiWeb: { $ne: false },
          images: { $exists: true, $type: "array", $ne: [] },
        })
        .project({ ma: 1, ten: 1, giaBan: 1, images: 1, image: 1 })
        .limit(maxItems)
        .toArray();

      for (const d of popularDocs) {
        if (!seenCodes.has(d.ma)) {
          seenCodes.add(d.ma);
          cards.push({
            ma: d.ma,
            ten: d.ten,
            giaBan: Number(d.giaBan || 0),
            image: Array.isArray(d.images) && d.images[0] ? d.images[0] : d.image || undefined,
            url: `/sp/${encodeURIComponent(d.ma)}`,
          });
        }
      }
    } catch {
      // bỏ qua
    }
  }

  return cards;
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
      const isProductQuery =
        Boolean(context.productName) ||
        /chậu|cây|mẫu|giá|bán|sen đá|kim tiền|lưỡi hổ|bàng|monstera|hạnh phúc|phát tài|composite|đá mài|gốm|sứ|để bàn|lọc không khí|phong thủy|tư vấn|sản phẩm|mua|đặt/i.test(
          latestUserMessage
        );

      if (isProductQuery && !orderCard) {
        productCards = await searchProductsByText(db, latestUserMessage, context, 4);
      }

      // 3. Chuẩn bị ngữ cảnh cho Gemini
      let contextAddition = "";
      if (context.productName) {
        contextAddition += `\n[KHÁCH ĐANG XEM SẢN PHẨM]: ${context.productName} (Mã: ${context.productCode || "N/A"}${context.productPrice ? `, Giá: ${context.productPrice.toLocaleString("vi-VN")}đ` : ""})`;
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
      if (aiReply && productCards.length === 0 && !orderCard) {
        productCards = await searchProductsByText(db, aiReply, context, 4);
      }

      // 5. Fallback nếu không có Gemini hoặc API bị nghẽn
      if (!aiReply) {
        if (orderCard) {
          aiReply = `Dạ Aloha đã kiểm tra đơn hàng **${orderCard.code}** của quý khách (${orderCard.receiver}):\n• Trạng thái: **${orderCard.statusText}**\n• Tổng thanh toán: **${orderCard.total.toLocaleString("vi-VN")}đ**\n\nNếu bạn cần hỗ trợ thêm hoặc muốn nhận ảnh thực tế cây trước khi giao, bạn nhắn Zalo 079 490 1233 nhé! 🌿`;
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
