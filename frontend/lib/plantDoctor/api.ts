export type DoctorImage = { id: string; previewUrl: string; base64: string; mimeType: string };

export type DoctorMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  images?: string[];
  suggest?: string[];
  demo?: boolean;
};

export type DoctorResponse =
  | { ok: true; reply: string; suggest: string[]; demo?: boolean }
  | { ok: false; error: string };

export async function askPlantDoctor(body: {
  mode?: "diagnose" | "identify";
  messages: { role: "user" | "assistant"; content: string }[];
  images: { mimeType: string; data: string }[];
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
    return { ok: false, error: (data as { error?: string } | null)?.error || "Bác sĩ AI đang bận, vui lòng thử lại." };
  } catch {
    return { ok: false, error: "Mất kết nối, vui lòng thử lại." };
  }
}

export const nowTime = () => new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
export const newId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
