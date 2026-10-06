export type DoctorImage = { id: string; previewUrl: string; base64: string; mimeType: string };

export type DoctorCondition =
  | "ung_re"
  | "thieu_sang"
  | "chay_nang"
  | "thieu_nuoc"
  | "sau_hai"
  | "nam_benh"
  | "thieu_dinh_duong"
  | "la_gia"
  | "khoe_manh"
  | "khac";
export type DoctorPlantGroup = "sen_da_xuong_rong" | "kieng_la" | "bonsai_cay_go" | "khac";

export type PlantCandidate = { profileId: string | null; name: string; scientificName: string; score: number; byAi?: boolean };

export type PlantSource = "plantnet" | "customer" | "text";

export type PlantIdentity = {
  profileId: string | null;
  name: string;
  scientificName: string;
  source: PlantSource;
  score: number | null;
  candidates: PlantCandidate[];
};

/** Cây đang khám, gửi lại server mỗi lượt để giữ đúng loài. */
export type PlantRef = { profileId: string | null; name: string; confirmed: boolean; source: PlantSource; score: number | null };

export type DoctorCardKind = "diagnosis" | "healthy" | "pick_problem" | "pick_plant" | "unknown_plant" | "off_topic";

/** Phiếu chẩn đoán server trả về (backend/plantDoctor/card.ts). */
export type DoctorCard = {
  kind: DoctorCardKind;
  offTopic: boolean;
  plantName: string;
  scientificName: string;
  title: string;
  confidence: "cao" | "vua" | "thap";
  severity: "nhe" | "chu_y" | "nang";
  summary: string;
  steps: string[];
  care: string[];
  whyDetail: string;
  followUps: { question: string; options: string[] }[];
  condition: DoctorCondition;
  plantGroup: DoctorPlantGroup;
  needHelp: boolean;
  plant: PlantIdentity | null;
  problemId: string | null;
  basics: PlantBasics | null;
  /** Thiếu ở phiếu cũ đã lưu trên máy trước khi đổi sang một nguồn mỗi loài. */
  source?: { name: string; url: string } | null;
  careByAloha?: boolean;
  reviewed: boolean;
};

export const LIGHT_LEVELS = {
  it_sang: "Chịu bóng, ít sáng",
  tan_xa: "Sáng tán xạ",
  sang_manh: "Sáng mạnh, có nắng nhẹ",
  nang: "Nắng trực tiếp",
} as const;

/** Thẻ chăm 5 dòng (backend/plantDoctor/profiles/types.ts). lightLevel/note thiếu ở phiếu cũ. */
export type PlantBasics = {
  lightLevel?: keyof typeof LIGHT_LEVELS;
  light: string;
  water: string;
  soil: string;
  toxic: string;
  note?: string;
};

export type DoctorMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  images?: string[];
  card?: DoctorCard | null;
};

export type DoctorResponse =
  | { ok: true; reply: string; card?: DoctorCard | null; candidates?: PlantCandidate[] }
  | { ok: false; error: string };

export async function askPlantDoctor(body: {
  mode?: "diagnose" | "identify";
  messages: { role: "user" | "assistant"; content: string }[];
  images: { mimeType: string; data: string }[];
  plant?: PlantRef | null;
  newPhotos?: boolean;
}): Promise<DoctorResponse> {
  try {
    const res = await fetch("/api/shop/plant-doctor", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as DoctorResponse | { error?: string } | null;
    if (data && "ok" in data) return data;
    if (data?.error) return { ok: false, error: data.error };
    return { ok: false, error: `Máy chủ đang khởi động lại hoặc mất kết nối (mã ${res.status}), bạn thử gửi lại sau vài giây nhé.` };
  } catch {
    return { ok: false, error: "Mất kết nối, vui lòng thử lại." };
  }
}

export type PlantDoctorAccess = { allowed: boolean; enabledForAll: boolean; tester: boolean };

export async function fetchPlantDoctorAccess(): Promise<PlantDoctorAccess> {
  const res = await fetch("/api/shop/plant-doctor/access", {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`access_${res.status}`);
  return (await res.json()) as PlantDoctorAccess;
}

export const nowTime = () => new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
export const newId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
