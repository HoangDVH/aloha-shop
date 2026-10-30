import type { DoctorCondition, DoctorPlantGroup } from "./api";

/** Một món trong bộ vật tư: mã KiotViet + lý do hiển thị cho khách. */
export type KitItem = { ma: string; why: string };

/** Đất & Giá thể thoát nước theo nhóm cây trong kho Aloha. */
const SOIL: Record<DoctorPlantGroup, KitItem[]> = {
  sen_da_xuong_rong: [
    { ma: "DSM6DM3", why: "Đất Soilmix riêng cho sen đá, xương rồng, thoát nước siêu nhanh" },
    { ma: "NTD1KG", why: "Đá nham thạch đen lót đáy chậu giúp ráo nước chống úng ngập" },
  ],
  kieng_la: [
    { ma: "DTC10DM", why: "Đá trân châu Perlite trộn vào đất tạo khe thở, chống ngạt rễ" },
    { ma: "DSM6DM3", why: "Đất Soilmix tơi xốp, thoát nước cực nhanh thay cho đất cũ đọng nước" },
  ],
  bonsai_cay_go: [
    { ma: "DSM6DM3", why: "Đất tơi xốp giữ ẩm vừa phải, thoáng khí cho rễ phát triển" },
    { ma: "NTD1KG", why: "Đá nham thạch lót đáy chậu giúp ráo nước chống thối rễ" },
  ],
  khac: [
    { ma: "DTC10DM", why: "Đá trân châu Perlite trộn vào đất cho rễ dễ thở" },
    { ma: "DSM6DM3", why: "Đất trồng mới tơi xốp, thoát nước tốt thay cho đất cũ" },
  ],
};

const ANTI_ROT: KitItem = {
  ma: "TBHT",
  why: "Trừ bệnh hư thân, sát khuẩn vết cắt và củ rễ chống nấm thối nhũn lan rộng",
};

const ANTI_FUNGUS: KitItem = {
  ma: "TTBCTC85",
  why: "Thuốc trừ nấm bệnh COC85 gốc đồng, trị dứt điểm đốm lá và vi khuẩn hại rễ",
};

const RECOVER_B12: KitItem = {
  ma: "GDCCB12",
  why: "Vitamin B12 giải độc chống sốc, làm mát và hồi sinh cây sau khi bị stress nhiệt/khô hạn",
};

const ROOT_BOOST: KitItem = {
  ma: "SRRRN200ML",
  why: "Siêu ra rễ Roots New kích thích các đầu lông hút của rễ phục hồi khả năng hút dinh dưỡng",
};

const PEST_CONTROL: KitItem = {
  ma: "TTSTS5G",
  why: "Thuốc trừ sâu rệp Tasieu sinh học, đặc trị rệp sáp và bọ trĩ kẽ lá",
};

/**
 * Bộ vật tư theo vấn đề AI chẩn đoán.
 * Chỉ gợi ý hàng thật 100% trong kho Aloha, chuẩn y khoa thực vật học.
 * Các trường hợp chỉ cần chỉnh thói quen (lá già, thiếu sáng) thì không gợi ý mua sắm.
 */
export function careKit(condition: DoctorCondition, group: DoctorPlantGroup): KitItem[] {
  switch (condition) {
    case "ung_re":
      // Cây úng rễ: Ưu tiên đá thoát nước + thuốc sát khuẩn rễ hư thân + đất mới (tuyệt đối không kích rễ ngay)
      return [SOIL[group][0], ANTI_ROT, SOIL[group][1]].filter(Boolean);

    case "thieu_nuoc":
      return [RECOVER_B12, ROOT_BOOST];

    case "chay_nang":
      return [RECOVER_B12];

    case "sau_hai":
      return [PEST_CONTROL, RECOVER_B12];

    case "nam_benh":
      return [ANTI_FUNGUS, ANTI_ROT];

    case "thieu_dinh_duong":
      return [ROOT_BOOST, SOIL[group][0]].filter(Boolean);

    case "khoe_manh":
      return [ROOT_BOOST];

    default:
      return [];
  }
}
