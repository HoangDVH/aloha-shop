import type { Condition, PlantGroup } from "../card.js";

export type Severity = "nhe" | "chu_y" | "nang";

/** Một vấn đề đã biết của loài: AI chỉ được chọn trong danh sách này, không tự viết cách chữa. */
export type Problem = {
  id: string;
  condition: Condition;
  title: string;
  /** Dấu hiệu nhìn thấy được: AI dùng để đối chiếu ảnh, khách dùng để tự chọn. */
  signs: string;
  summary: string;
  why: string;
  steps: string[];
  care: string[];
  severity: Severity;
  needHelp: boolean;
};

export const LIGHT_LEVELS = {
  it_sang: "Chịu bóng, ít sáng",
  tan_xa: "Sáng tán xạ",
  sang_manh: "Sáng mạnh, có nắng nhẹ",
  nang: "Nắng trực tiếp",
} as const;
export type LightLevel = keyof typeof LIGHT_LEVELS;

/** Thẻ chăm 5 dòng cho khách. */
export type PlantBasics = { lightLevel: LightLevel; light: string; water: string; soil: string; toxic: string; note: string };

export type PlantSource = { name: string; url: string };

export type PlantProfile = {
  id: string;
  nameVi: string;
  /** Tên gọi khách hay dùng (có dấu); khớp không phân biệt dấu. */
  aliases: string[];
  scientific: string;
  /** Khớp kết quả Pl@ntNet: loài trước, rồi chi, rồi họ. */
  match: { species?: string[]; genera?: string[]; families?: string[] };
  group: PlantGroup;
  basics: PlantBasics;
  /** Tên bài viết sản phẩm Aloha (Drive) làm nguồn cho ánh sáng / tưới nước; null = theo nguồn tham khảo. */
  alohaDoc: string | null;
  /** 3–5 vấn đề, chỉ những gì nguồn tham khảo hoặc tài liệu Aloha có nhắc. */
  problems: Problem[];
  /** Một nguồn uy tín duy nhất cho độc tính, sâu bệnh và phần chăm Aloha chưa ghi. */
  source: PlantSource;
  /** false = chờ nhân viên Aloha duyệt. */
  reviewed: boolean;
};

export const ncsu = (slug: string, latin: string): PlantSource => ({
  name: `NC State Extension Plant Toolbox – ${latin}`,
  url: `https://plants.ces.ncsu.edu/plants/${slug}/`,
});

export const NO_TOXIC_DATA = "Nguồn tham khảo không ghi độc tính; vẫn nên để xa tầm với trẻ nhỏ và thú cưng.";

export const BRING = "Nếu bạn không tự tin, mang cây ra Aloha để được hỗ trợ.";

type Base = { id?: string; signs: string; why?: string; severity?: Severity; extraSteps?: string[]; extraCare?: string[] };

/** Úng rễ do tưới nhiều – dry: điều kiện được tưới lại của riêng loài. */
export function rootRot(o: Base & { dry: string }): Problem {
  return {
    id: o.id ?? "ung_re",
    condition: "ung_re",
    title: "Tưới nhiều, rễ bị úng",
    signs: o.signs,
    summary: "Đất ẩm quá lâu làm rễ bị ngạt và bắt đầu thối. Phát hiện sớm thì cây vẫn cứu được.",
    why:
      o.why ??
      "Rễ cần không khí để thở. Khi đất ướt liên tục, rễ bị ngạt và nấm trong đất làm rễ thối, cây không hút được nước nên lá vàng, héo dù đất vẫn ẩm.",
    steps: [
      `Ngưng tưới ngay, chỉ tưới lại khi ${o.dry}.`,
      "Đổ hết nước đọng dưới đĩa lót chậu, để cây chỗ thoáng gió, có ánh sáng để đất mau khô.",
      ...(o.extraSteps ?? ["Cắt bỏ lá đã vàng nhũn bằng kéo sạch."]),
      `Nếu gốc đã mềm, thâm đen hoặc đất có mùi hôi: nhấc cây khỏi chậu, cắt bỏ rễ thối và trồng lại bằng đất mới thoát nước. ${BRING}`,
    ],
    care: [`Chỉ tưới khi ${o.dry}.`, "Dùng chậu có lỗ thoát nước, không để nước đọng dưới đĩa.", ...(o.extraCare ?? [])],
    severity: o.severity ?? "chu_y",
    needHelp: true,
  };
}

/** Thiếu nước – water: cách tưới đúng của riêng loài. */
export function thirsty(o: Base & { water: string }): Problem {
  return {
    id: o.id ?? "thieu_nuoc",
    condition: "thieu_nuoc",
    title: "Thiếu nước",
    signs: o.signs,
    summary: "Cây đang khát nước. Tưới lại đúng cách thì phần lá còn mềm sẽ tươi lại sau vài ngày.",
    why: o.why ?? "Khi đất khô quá lâu, rễ không đủ nước nuôi lá nên lá héo, nhăn rồi khô dần từ mép.",
    steps: [
      "Tưới đẫm từ từ cho tới khi nước chảy ra lỗ đáy chậu, rồi đổ nước thừa dưới đĩa.",
      "Nếu đất khô cứng không thấm nước, đặt đáy chậu vào thau nước khoảng 15–20 phút rồi nhấc ra cho ráo.",
      ...(o.extraSteps ?? ["Cắt bỏ phần lá đã khô giòn; lá chỉ héo mềm thường sẽ tươi lại."]),
    ],
    care: [o.water, "Thử đất bằng ngón tay hoặc que tre trước khi tưới.", ...(o.extraCare ?? [])],
    severity: o.severity ?? "nhe",
    needHelp: false,
  };
}

/** Thiếu sáng – light: chỗ đặt phù hợp của riêng loài. */
export function lowLight(o: Base & { light: string }): Problem {
  return {
    id: o.id ?? "thieu_sang",
    condition: "thieu_sang",
    title: "Thiếu ánh sáng",
    signs: o.signs,
    summary: "Cây đang thiếu sáng nên mọc yếu. Dời chỗ sáng hơn là cây sẽ khoẻ lại dần.",
    why: o.why ?? "Thiếu sáng thì cây không tự tạo đủ thức ăn, nên vươn dài tìm sáng, lá nhỏ và nhạt màu hơn.",
    steps: [
      `Dời cây tới chỗ sáng hơn: ${o.light}.`,
      "Chuyển chỗ từ từ trong khoảng 1 tuần để lá quen dần, tránh bị cháy.",
      ...(o.extraSteps ?? ["Xoay chậu mỗi tuần để cây mọc đều các phía."]),
    ],
    care: [o.light, "Cây để chỗ tối thì đất lâu khô hơn, nên tưới thưa hơn.", ...(o.extraCare ?? [])],
    severity: o.severity ?? "nhe",
    needHelp: false,
  };
}

/** Cháy nắng / sốc nắng – light: chỗ đặt phù hợp của riêng loài. */
export function sunburn(o: Base & { light: string }): Problem {
  return {
    id: o.id ?? "chay_nang",
    condition: "chay_nang",
    title: "Cháy nắng",
    signs: o.signs,
    summary: "Lá bị nắng gắt làm cháy. Phần cháy không xanh lại nhưng cây vẫn mọc lá mới bình thường.",
    why:
      o.why ??
      "Nắng chiếu thẳng quá mạnh, nhất là khi cây vừa chuyển từ chỗ râm ra, làm mô lá bị cháy thành mảng bạc, vàng hoặc nâu khô.",
    steps: [
      "Dời cây khỏi chỗ nắng gắt chiếu thẳng, nhất là nắng trưa và nắng chiều.",
      "Vết cháy không hồi lại được: cháy ít thì để nguyên, cháy nhiều thì cắt bỏ bằng kéo sạch.",
      "Kiểm tra đất: đất khô thì tưới, còn ẩm thì không tưới thêm.",
      ...(o.extraSteps ?? []),
    ],
    care: [o.light, ...(o.extraCare ?? [])],
    severity: o.severity ?? "nhe",
    needHelp: false,
  };
}

/** Dấu hiệu các loại sâu bọ hút nhựa hay gặp, dùng chung cho mọi loài. */
export const PEST_SIGNS = {
  rep_sap: "nách lá, kẽ lá có cụm bông trắng như bông gòn",
  rep_vay: "thân, cuống, gân lá có vảy nhỏ màu nâu bám chặt, cạo ra được",
  nhen_do: "lá lấm tấm chấm vàng nhạt li ti, mặt dưới lá có tơ mịn như mạng nhện",
  rep: "đọt non có đám rệp nhỏ màu xanh hoặc đen bám, lá non quăn",
  bo_tri: "lá có vệt bạc và chấm đen li ti, lá non biến dạng",
  rep_phan: "mặt dưới lá có con nhỏ màu trắng, chạm vào bay lên như bụi",
} as const;
const PEST_NAMES = { rep_sap: "rệp sáp", rep_vay: "rệp vảy", nhen_do: "nhện đỏ", rep: "rệp", bo_tri: "bọ trĩ", rep_phan: "rệp phấn trắng" } as const;
type PestKey = keyof typeof PEST_NAMES;

const joinOr = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} hoặc ${xs[xs.length - 1]}`);

/** Sâu bọ hút nhựa – kinds: các loại nguồn tham khảo ghi là hay gặp trên loài này. */
export function pests(o: Omit<Base, "signs"> & { kinds: PestKey[]; signs?: string; noWash?: boolean }): Problem {
  const names = o.kinds.map((k) => PEST_NAMES[k]);
  const signs = o.kinds.map((k) => PEST_SIGNS[k]);
  return {
    id: o.id ?? (o.kinds.length === 1 ? o.kinds[0] : "sau_hai"),
    condition: "sau_hai",
    title: `Bị ${joinOr(names)}`,
    signs: o.signs ?? `${signs.map((s, i) => (i ? s : s[0].toUpperCase() + s.slice(1))).join("; hoặc ")}; lá có thể vàng, dính nhớt.`,
    summary: "Cây đang bị sâu bọ hút nhựa. Xử lý sớm và lặp lại vài lần là sạch.",
    why:
      o.why ??
      "Các loại rệp, nhện nhỏ hút nhựa ở mặt dưới lá và nách lá làm lá vàng, lốm đốm, cây còi dần; chúng sinh sôi nhanh khi không khí khô, ít thoáng gió.",
    steps: [
      "Để riêng cây ra xa các cây khác để sâu bọ không lây.",
      "Dùng tăm bông hoặc khăn ẩm lau sạch rệp và các mảng bông trắng ở nách lá, mặt dưới lá.",
      o.noWash
        ? "Không xịt nước vào giữa nụ lá; nếu cần rửa thì nghiêng chậu, xịt nhẹ rồi để khô thoáng ngay."
        : "Xịt rửa cả mặt trên và mặt dưới lá bằng vòi nước nhẹ, để lá khô thoáng.",
      "Lặp lại 5–7 ngày một lần trong 3–4 tuần vì trứng sẽ tiếp tục nở. Bị nhiều thì dùng chế phẩm trừ sâu sinh học hoặc dầu neem có bán tại Aloha, pha đúng hướng dẫn trên bao bì.",
      ...(o.extraSteps ?? []),
    ],
    care: ["Mỗi lần tưới, xem qua mặt dưới lá và nách lá để phát hiện sớm.", ...(o.extraCare ?? [])],
    severity: o.severity ?? "chu_y",
    needHelp: false,
  };
}

/** Lá già vàng rụng tự nhiên. */
export function oldLeaves(o: Base): Problem {
  return {
    id: o.id ?? "la_gia",
    condition: "la_gia",
    title: "Lá già rụng tự nhiên",
    signs: o.signs,
    summary: "Đây là chuyện bình thường khi cây lớn, không phải bệnh.",
    why: o.why ?? "Cây tự bỏ bớt lá già phía dưới để dồn sức nuôi lá non. Chỉ đáng lo khi lá non hoặc ngọn cũng vàng.",
    steps: ["Ngắt bỏ lá đã vàng hẳn cho gọn.", "Giữ nguyên cách chăm nếu ngọn và lá non vẫn xanh khoẻ.", ...(o.extraSteps ?? [])],
    care: ["Theo dõi lá non: nếu lá non cũng vàng thì gửi thêm ảnh để kiểm tra lại.", ...(o.extraCare ?? [])],
    severity: "nhe",
    needHelp: false,
  };
}

/** Cây trồng nước (thuỷ sinh): nước bẩn, rễ thối – change: lịch thay nước của riêng loài. */
export function hydroRot(o: Base & { change: string }): Problem {
  return {
    id: o.id ?? "thuy_sinh",
    condition: "ung_re",
    title: "Cây trồng nước: nước bẩn, rễ thối",
    signs: o.signs,
    summary: "Nước để lâu không thay làm rễ thối. Rửa rễ, cắt phần hỏng và thay nước sạch là cây hồi lại.",
    why: o.why ?? "Nước để lâu bị thiếu không khí và sinh vi khuẩn, rêu, làm rễ nhớt, thâm đen và bốc mùi.",
    steps: [
      "Nhấc cây ra, rửa sạch rễ dưới vòi nước nhẹ.",
      "Cắt bỏ rễ đen, nhũn, có mùi bằng kéo sạch; giữ lại rễ trắng hoặc nâu nhạt còn chắc.",
      "Rửa sạch bình, thay nước mới (nước máy để qua đêm hoặc nước lọc); chỉ cho ngập khoảng 2/3 bộ rễ, không ngập thân.",
      ...(o.extraSteps ?? []),
    ],
    care: [o.change, "Để bình chỗ sáng nhưng tránh nắng chiếu thẳng để nước không nóng và mau rêu.", ...(o.extraCare ?? [])],
    severity: o.severity ?? "chu_y",
    needHelp: false,
  };
}

/** Nấm đốm lá do lá ướt lâu, bí gió. */
export function leafSpot(o: Base): Problem {
  return {
    id: o.id ?? "dom_la",
    condition: "nam_benh",
    title: "Đốm lá do nấm",
    signs: o.signs,
    summary: "Lá bị nấm đốm do ẩm và bí gió. Cắt bỏ lá bệnh, giữ lá khô thoáng là bệnh dừng lại.",
    why: o.why ?? "Nấm gây đốm lá phát triển khi lá ướt lâu, cây đặt chỗ bí gió hoặc trồng sát nhau.",
    steps: [
      "Cắt bỏ lá có đốm bằng kéo sạch, bỏ vào túi kín rồi vứt đi.",
      "Tưới vào gốc, không tưới hoặc phun ướt lá; dời cây ra chỗ thoáng gió.",
      `Đốm lan nhanh sang nhiều lá: dùng thuốc trừ nấm sinh học có bán tại Aloha theo hướng dẫn trên bao bì. ${BRING}`,
      ...(o.extraSteps ?? []),
    ],
    care: ["Tưới vào buổi sáng, vào gốc, để lá khô ráo.", "Đặt cây chỗ thoáng gió, không xếp sát các cây khác.", ...(o.extraCare ?? [])],
    severity: o.severity ?? "chu_y",
    needHelp: false,
  };
}

/** Nấm phấn trắng do bí gió. */
export function powderyMildew(o: Base): Problem {
  return {
    id: o.id ?? "phan_trang",
    condition: "nam_benh",
    title: "Nấm phấn trắng",
    signs: o.signs,
    summary: "Lá bị nấm phấn trắng. Cắt bỏ phần bệnh và để cây thoáng gió là bệnh giảm.",
    why: o.why ?? "Nấm phấn trắng phát triển khi cây đặt chỗ bí gió, ẩm, ít nắng.",
    steps: [
      "Cắt bỏ lá, cành bị phủ phấn, bỏ vào túi kín rồi vứt đi.",
      "Dời cây ra chỗ thoáng gió, tách xa các cây khác.",
      `Bệnh lan nhiều: dùng thuốc trừ nấm sinh học có bán tại Aloha theo hướng dẫn trên bao bì. ${BRING}`,
    ],
    care: ["Giữ cây chỗ thoáng gió; tưới vào gốc, không tưới ướt lá.", ...(o.extraCare ?? [])],
    severity: o.severity ?? "chu_y",
    needHelp: false,
  };
}

/** Ruồi nấm (ruồi nhỏ quanh chậu) do đất ẩm lâu. */
export function fungusGnats(o?: Partial<Base>): Problem {
  return {
    id: o?.id ?? "ruoi_nam",
    condition: "sau_hai",
    title: "Có ruồi nhỏ bay quanh chậu (ruồi nấm)",
    signs: o?.signs ?? "Có nhiều con ruồi nhỏ màu đen bay quanh chậu hoặc đậu trên mặt đất; đất thường ẩm lâu.",
    summary: "Ruồi nấm đẻ trứng trong đất ẩm. Để đất khô hơn giữa các lần tưới là chúng giảm hẳn.",
    why: "Ấu trùng ruồi nấm sống trong lớp đất mặt ẩm, ăn chất hữu cơ và rễ non; đất càng ẩm lâu chúng càng sinh sôi.",
    steps: [
      "Để lớp đất mặt khô hẳn rồi mới tưới lại.",
      "Dọn lá mục, rác hữu cơ trên mặt chậu.",
      "Cắm bẫy dính màu vàng cạnh chậu để bắt ruồi trưởng thành.",
    ],
    care: ["Không tưới khi đất mặt còn ẩm; đổ nước đọng dưới đĩa.", ...(o?.extraCare ?? [])],
    severity: "nhe",
    needHelp: false,
  };
}

/** Bị lạnh, gió máy lạnh thổi thẳng. */
export function coldDamage(signs: string): Problem {
  return {
    id: "lanh",
    condition: "khac",
    title: "Lá bị lạnh (gió máy lạnh thổi thẳng)",
    signs,
    summary: "Lá bị tổn thương do lạnh. Phần lá hỏng không hồi lại, nhưng dời chỗ ấm thì cây ra lá mới bình thường.",
    why: "Cây nhiệt đới này không chịu được lạnh: gió máy lạnh thổi thẳng hoặc nhiệt độ thấp làm lá có mảng sẫm màu, sũng nước rồi khô.",
    steps: [
      "Dời cây khỏi luồng gió máy lạnh, cửa gió và chỗ có gió lùa.",
      "Cắt bỏ lá đã nhũn hoặc khô bằng kéo sạch.",
      "Tưới thưa hơn trong lúc cây hồi phục vì đất lâu khô.",
    ],
    care: ["Để cây ở chỗ ấm, tránh gió máy lạnh và gió lùa ban đêm."],
    severity: "chu_y",
    needHelp: false,
  };
}

/** Vấn đề riêng của loài, viết tay. */
export function custom(p: Omit<Problem, "needHelp"> & { needHelp?: boolean }): Problem {
  return { ...p, needHelp: p.needHelp ?? p.severity === "nang" };
}
