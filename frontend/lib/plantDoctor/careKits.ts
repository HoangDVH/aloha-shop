import type { DoctorCondition, DoctorPlantGroup } from "./api";

/** Một món trong bộ vật tư: mã KiotViet + lý do hiển thị cho khách. */
export type KitItem = { ma: string; why: string };

/** Đất thay mới theo nhóm cây (dùng khi úng rễ hoặc đất cũ bạc màu). */
const SOIL: Record<DoctorPlantGroup, KitItem[]> = {
  sen_da_xuong_rong: [
    { ma: "DSM6DM3", why: "Đất riêng cho sen đá, xương rồng, thoát nước nhanh" },
    { ma: "NTD1KG", why: "Đá trộn vào đất cho thoáng, rễ không bị úng" },
  ],
  kieng_la: [
    { ma: "NAMIX5DM3", why: "Đất trồng mới tơi xốp, thay cho đất cũ bị ẩm lâu" },
    { ma: "DTC10DM", why: "Đá trân châu trộn vào đất cho thoáng, rễ dễ thở" },
  ],
  bonsai_cay_go: [
    { ma: "DAKDMLKG", why: "Đất hạt cho bonsai, giữ ẩm vừa phải và thoáng rễ" },
    { ma: "NTD1KG", why: "Đá trộn vào đất cho thoáng, rễ không bị úng" },
  ],
  khac: [
    { ma: "NAMIX5DM3", why: "Đất trồng mới tơi xốp, thay cho đất cũ bị ẩm lâu" },
    { ma: "DTC10DM", why: "Đá trân châu trộn vào đất cho thoáng, rễ dễ thở" },
  ],
};

const ROOTING: KitItem = { ma: "KRM25G", why: "Kích rễ, giúp cây ra rễ mới sau khi thay đất" };
const SLOW_FEED: KitItem = { ma: "PTCV50G", why: "Phân tan chậm, rải mặt chậu nuôi cây 2–3 tháng" };
const RECOVER: KitItem = { ma: "GDCCB12", why: "Vitamin B12 giúp cây hồi sức sau khi bị sốc" };
const SPRAYER: KitItem = { ma: "BX05L", why: "Bình xịt nhỏ để phun thuốc đều lên lá" };

/**
 * Bộ vật tư theo vấn đề AI chẩn đoán. Chỉ gợi ý hàng thật trong kho, không để AI tự đặt từ khoá tìm kiếm.
 * Vấn đề chỉ cần đổi thói quen (lá già, thiếu sáng) thì không gợi ý mua gì.
 */
export function careKit(condition: DoctorCondition, group: DoctorPlantGroup): KitItem[] {
  switch (condition) {
    case "ung_re":
      return [...SOIL[group], ROOTING];
    case "thieu_dinh_duong":
      return [SLOW_FEED, SOIL[group][0]];
    case "chay_nang":
    case "thieu_nuoc":
      return [RECOVER];
    case "sau_hai":
      return [{ ma: "TTSTS5G", why: "Thuốc trừ sâu, rệp; pha đúng liều ghi trên gói" }, SPRAYER];
    case "nam_benh":
      return [{ ma: "TBHT", why: "Thuốc trừ bệnh do nấm; dùng đúng hướng dẫn trên gói" }, SPRAYER];
    case "khoe_manh":
      return [SLOW_FEED];
    default:
      return [];
  }
}
