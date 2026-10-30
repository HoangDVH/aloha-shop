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

export const BRING = "Nếu ca nặng hoặc chưa tự tin tự xử lý, hãy nhắn Zalo nhà vườn Aloha để được hỗ trợ 1-1.";

type Base = { id?: string; signs: string; why?: string; severity?: Severity; extraSteps?: string[]; extraCare?: string[] };

/** Úng rễ do tưới nhiều – dry: điều kiện được tưới lại của riêng loài. */
export function rootRot(o: Base & { dry: string }): Problem {
  return {
    id: o.id ?? "ung_re",
    condition: "ung_re",
    title: "Tưới nhiều, rễ bị úng",
    signs: o.signs,
    summary: "Đất ẩm quá lâu làm rễ bị ngạt thiếu oxy và bắt đầu thối nhũn. Phát hiện sớm thì cây cứu lại rất dễ.",
    why:
      o.why ??
      "Rễ cần không khí để thở. Khi đất ướt liên tục, rễ bị ngạt và nấm trong đất làm rễ thối nhũn, cây không hút được nước nên cuống lá vàng, héo rũ dù đất vẫn ướt sũng.",
    steps: [
      "Đổ sạch nước đang đọng ở đĩa lót dưới đáy chậu đi. Kê 2 nắp chai dưới đáy chậu để thông gió.",
      "Lấy 1 chiếc đũa ăn cơm chọc nhẹ 4–5 lỗ quanh mép chậu xuống sâu để đất thở và thoát ẩm nhanh gấp 3 lần.",
      `Cắt bỏ lá đã vàng nhũn. Bỏ đói không tưới nước cho tới khi ${o.dry}.`,
      `Nếu thân gốc đã mềm nhũn, lung lay hoặc đất bốc mùi: nhấc bầu cây ra, dùng kéo cắt bỏ rễ thối đen và trồng lại vào chậu vừa khít rễ (tuyệt đối không dùng chậu to). ${BRING}`,
    ],
    care: [`Chỉ tưới khi ${o.dry}. Luôn thử bằng que đũa trước khi tưới.`, "Dùng chậu có lỗ thoát nước, không bao giờ để nước đọng dưới đĩa.", ...(o.extraCare ?? [])],
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
    summary: "Cây đang khát nước nghiêm trọng. Cấp nước đúng cách thì lá sẽ ngẩng đầu tươi lại sau vài tiếng.",
    why: o.why ?? "Đất khô kiệt lâu ngày khiến rễ không hút được nước nuôi cành lá, làm toàn bộ cuống lá mềm rũ và khô dần từ mép.",
    steps: [
      "Áp dụng mẹo ngâm mông: Đặt đáy chậu vào thau nước ngập 1/3 chậu trong 15–20 phút để đất hút no nước từ đáy lên.",
      "Nhấc chậu ra ngoài để róc hết nước thừa chảy ra đĩa rồi mới đặt lại vào bàn.",
      ...(o.extraSteps ?? ["Dùng kéo bấm tỉa phần đầu lá đã khô giòn; các lá chỉ rũ mềm sẽ tự đứng dậy sau 2–4 tiếng."]),
    ],
    care: [o.water, "Thử đất bằng que đũa hoặc ngón tay trước khi tưới.", ...(o.extraCare ?? [])],
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
    summary: "Cây đang thiếu sáng nên mọc vươn dài khẳng khiu. Dời ra chỗ sáng hơn là cây sẽ khoẻ lại dần.",
    why: o.why ?? "Thiếu sáng khiến cây không quang hợp đủ để tạo dinh dưỡng, buộc phải vươn dài tìm sáng, lá nhỏ và nhạt màu.",
    steps: [
      `Dời cây tới chỗ sáng hơn: ${o.light}.`,
      "Cứ 3–4 ngày, xoay chậu cây nửa vòng để các mặt nhận sáng đều, cây không bị nghiêng vẹo.",
      ...(o.extraSteps ?? ["Bấm tỉa các ngọn quá dài để cây đẻ nhánh mới rậm rạp hơn."]),
    ],
    care: [o.light, "Cây để chỗ ít nắng thì đất lâu khô hơn, nên kéo dãn chu kỳ tưới thưa hơn.", ...(o.extraCare ?? [])],
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
    summary: "Lá bị nắng gắt làm cháy khô mảng. Cây sẽ sớm ra lá mới khỏe mạnh khi được chuyển chỗ râm mát.",
    why:
      o.why ??
      "Nắng trưa hoặc chiều chiếu thẳng qua kính quá mạnh làm mô lá bị cháy thành mảng bạc, vàng hoặc nâu khô giòn.",
    steps: [
      "Dời cây lùi sâu vào trong nhà ngay (cách cửa kính ít nhất 1m hoặc sau lớp rèm che mỏng).",
      "Dùng kéo bấm bỏ phần mép lá đã cháy khô giòn (chừa lại 1mm viền khô để không phạm vào phần xanh).",
      "Xịt sương nhẹ quanh không khí để hạ nhiệt làm mát cây; không tưới đẫm nước hay bón phân ngay lúc này.",
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
    summary: "Cây đang bị rệp hoặc bọ chích hút nhựa. Dùng đồ nhà bếp xử lý vài lần là sạch bóng.",
    why:
      o.why ??
      "Các loại rệp sáp, rệp vảy hút nhựa ở kẽ lá và mặt dưới lá làm cây còi cọc; chúng sinh sôi nhanh khi phòng khô bí gió.",
    steps: [
      "Để riêng cây ra xa các cây khác để rệp không bò lây sang.",
      "Lấy que tăm bông chấm cồn y tế (hoặc rượu trắng) dí thẳng vào từng đốm bông rệp sáp để diệt ngay tại chỗ.",
      "Pha 3 giọt nước rửa chén vào 1 bình xịt nước (500ml), lắc đều rồi xịt kỹ vào kẽ lá, 30 phút sau dùng khăn ướt lau sạch.",
      "Lặp lại sau 5–7 ngày nếu thấy rệp còn xuất hiện.",
      ...(o.extraSteps ?? []),
    ],
    care: ["Mỗi lần tưới, xem qua mặt dưới lá và kẽ lá để phát hiện sớm.", ...(o.extraCare ?? [])],
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
    summary: "Yên tâm: Đây là quy luật sinh lý tự nhiên khi cây lớn (như người rụng tóc mọc tóc mới), hoàn toàn không phải bệnh.",
    why: o.why ?? "Cây tự đào thải bớt lá già sát gốc để dồn dinh dưỡng nuôi chồi non xanh mướt phía trên.",
    steps: [
      "Dùng kéo bấm sát cuống các lá đã vàng rũ bỏ đi cho chậu cây gọn gàng, đẹp mắt.",
      "Giữ nguyên cách chăm sóc hiện tại nếu thấy các ngọn và lá non vẫn xanh mướt bình thường.",
      ...(o.extraSteps ?? []),
    ],
    care: ["Theo dõi lá non: nếu lá non cũng bị vàng hoặc nhũn thì chụp ảnh gửi Bác sĩ cây kiểm tra lại.", ...(o.extraCare ?? [])],
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
    summary: "Lá bị nấm đốm do ẩm ướt và phòng bí gió. Cắt bỏ lá bệnh, giữ lá khô thoáng là bệnh dừng lại ngay.",
    why: o.why ?? "Nấm đốm lá phát triển khi nước đọng trên mặt lá quá lâu hoặc phòng kín ít thông gió.",
    steps: [
      "Dùng kéo cắt bỏ ngay các lá có đốm đen, bỏ vào túi rác kín để nấm không lây sang lá lành.",
      "Lấy thìa cạo bỏ lớp đất mốc trắng trên mặt chậu bỏ đi, dời cây ra nơi thoáng gió.",
      "Chỉ tưới nước sát gốc cây vào ban ngày; tuyệt đối không tưới phun ướt lá vào ban đêm.",
      `Nếu đốm lan nhanh sang nhiều lá: nhắn Zalo Aloha để được tư vấn dung dịch sinh học an toàn. ${BRING}`,
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
