/** Câu trả lời mẫu khi chưa cấu hình GEMINI_API_KEY (chép từ ALOHA-GARDEN-2, rút gọn). Luôn gắn nhãn demo. */
const DEMO_NOTE = "*(Chế độ demo: chưa bật AI thật, đây là câu trả lời mẫu.)*\n\n";

const SUCCULENT_ROT = `Tên Cây: Sen Đá Sỏi Hồng - *Graptopetalum amethystinum*

🩺 TÌNH TRẠNG CÂY:
Lá bẹt, vàng úng cục bộ. Nguyên nhân thường gặp: giá thể bết chặt, chậu thoát nước kém khiến rễ mọng nước bị ngạt và thối rễ tơ; tưới sũng từ trên ngọn làm nước đọng nách lá.

💊 ĐIỀU TRỊ:
- **Bước 1 (Xử lý rễ trần):** Nhấc cây khỏi chậu, giũ sạch đất cũ, cắt bỏ rễ thối đen bằng kéo đã sát trùng cồn. Để rễ khô thoáng nơi râm mát 4–5 ngày.
- **Bước 2 (Sát khuẩn):** Vặt lá úng sát thân, bôi keo liền sẹo hoặc bột vôi nông nghiệp lên vết cắt.
- **Bước 3 (Trồng lại):** Trồng vào giá thể tơi xốp mới, cho cây đón nắng sớm nhẹ.

⚠️ LƯU Ý KHI TRỒNG LOẠI CÂY NÀY:
- Công thức giá thể tối ưu: 50% đá bọt Pumice, 30% Perlite, 20% xơ dừa đã xả chát.
- Yêu cầu về chậu: chậu đất nung hoặc gốm có lỗ thoát nước, tránh chậu nhựa bít kín.
- Ánh sáng & chu kỳ tưới: nắng sáng 4–6 tiếng; chỉ tưới khi đáy chậu đã khô hẳn.

GỢI Ý SẢN PHẨM: đá bọt, perlite, chậu đất nung`;

const MEALYBUG = `Tên Cây: Sen Đá Đô La - *Portulacaria afra*

🩺 TÌNH TRẠNG CÂY:
Rệp sáp bông trắng (*Pseudococcidae*) bám dày ở kẽ lá, hút nhựa khiến cây còi, lá xỉn. Nguyên nhân: nách lá đọng ẩm, chỗ đặt cây bí gió.

💊 ĐIỀU TRỊ:
- **Bước 1:** Dùng tăm bông nhúng cồn 70 độ lau sạch rệp và lớp phấn trắng.
- **Bước 2:** Rũ bỏ đất cũ có thể chứa trứng rệp, phơi rễ nơi râm mát 3–5 ngày.
- **Bước 3:** Trồng lại bằng giá thể mới, đặt nơi thoáng gió.

⚠️ LƯU Ý KHI TRỒNG LOẠI CÂY NÀY:
- Công thức giá thể tối ưu: 70% đá bọt Pumice, 30% Perlite.
- Yêu cầu về chậu: chậu đất nung thoát khí tốt.
- Ánh sáng & chu kỳ tưới: nắng gió ban công 6 tiếng/ngày; tưới gốc, không tưới lên ngọn.

GỢI Ý SẢN PHẨM: đá bọt, perlite, chậu đất nung`;

const LEGGY = `Tên Cây: Cây cảnh - *Bonsai sp.*

🩺 TÌNH TRẠNG CÂY:
Vàng lá, cây vươn dài mất dáng do thiếu sáng và giá thể bí khí khiến rễ yếu.

💊 ĐIỀU TRỊ:
- **Bước 1:** Cắt tỉa cành tăm, cành sâu bệnh cho tán thông thoáng.
- **Bước 2:** Rũ đất bết cũ, tỉa rễ úng, để rễ ráo 3 ngày nơi râm mát.
- **Bước 3:** Trồng lại vào giá thể thoáng khí, đưa cây ra chỗ có nắng sáng.

⚠️ LƯU Ý KHI TRỒNG LOẠI CÂY NÀY:
- Công thức giá thể tối ưu: tăng tỉ lệ Akadama, đá bọt Pumice, thêm ít xơ dừa xả chát.
- Yêu cầu về chậu: chậu gốm hoặc đất nung thoát khí.
- Ánh sáng & chu kỳ tưới: nắng dịu 4–6 tiếng; khô đáy chậu mới tưới.

GỢI Ý SẢN PHẨM: đá bọt, akadama, chậu gốm`;

export function demoReply(lastMessage: string, hasImages: boolean): string {
  const q = lastMessage.toLowerCase();
  if (/rệp|sáp|phấn trắng/.test(q)) return DEMO_NOTE + MEALYBUG;
  if (hasImages || /thối|úng|nhũn|sỏi hồng/.test(q)) return DEMO_NOTE + SUCCULENT_ROT;
  return DEMO_NOTE + LEGGY;
}

export const DEMO_IDENTIFY = "Sen đá Sỏi Hồng\nSen đá Thạch Ngọc\nSen đá Yên Chi";
