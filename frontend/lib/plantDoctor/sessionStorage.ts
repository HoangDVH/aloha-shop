import type { DoctorCard, DoctorMessage, PlantRef } from "./api";

export type PlantDoctorSessionSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  plantName?: string;
};

export type PlantDoctorSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  plant: PlantRef | null;
  messages: DoctorMessage[];
};

const DB_NAME = "aloha_plant_doctor_db";
const DB_VERSION = 1;
const STORE_NAME = "sessions";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Tự động sinh tiêu đề thông minh chuẩn y khoa cây cảnh (VD: "Lưỡi hổ – Cháy khô mép lá") */
export function generateSessionTitle(card?: DoctorCard | null, firstPrompt?: string): string {
  if (card?.plantName && card?.title) {
    const raw = `${card.plantName} – ${card.title}`;
    return raw.length > 36 ? `${raw.slice(0, 36).trim()}…` : raw;
  }
  if (card?.plantName) {
    return `Khám cây ${card.plantName}`;
  }
  if (firstPrompt) {
    const clean = firstPrompt.replace(/[*#`_]/g, "").replace(/\s+/g, " ").trim();
    if (clean) return clean.length > 30 ? `${clean.slice(0, 30).trim()}…` : clean;
  }
  return "Ca khám cây mới";
}

/** Phân nhóm thời gian chuẩn ChatGPT: Hôm nay, Hôm qua, 7 ngày trước, Cũ hơn */
export function getSessionTimeGroup(timestamp: number): "today" | "yesterday" | "last7Days" | "last30Days" | "older" {
  const now = new Date();
  const date = new Date(timestamp);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOf7Days = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const startOf30Days = startOfToday - 29 * 24 * 60 * 60 * 1000;

  const t = date.getTime();
  if (t >= startOfToday) return "today";
  if (t >= startOfYesterday) return "yesterday";
  if (t >= startOf7Days) return "last7Days";
  if (t >= startOf30Days) return "last30Days";
  return "older";
}

export const TIME_GROUP_LABELS: Record<string, string> = {
  today: "Hôm nay",
  yesterday: "Hôm qua",
  last7Days: "7 ngày qua",
  last30Days: "30 ngày qua",
  older: "Cũ hơn",
};

/** Lấy danh sách tóm tắt tất cả các phiên khám (nhẹ để render sidebar nhanh) */
export async function listSessions(): Promise<PlantDoctorSessionSummary[]> {
  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result || []) as PlantDoctorSession[];
        const summaries: PlantDoctorSessionSummary[] = all.map((s) => ({
          id: s.id,
          title: s.title || "Ca khám cây",
          createdAt: s.createdAt,
          updatedAt: s.updatedAt || s.createdAt,
          messageCount: Array.isArray(s.messages) ? s.messages.length : 0,
          plantName: s.plant?.name,
        }));
        // Sắp xếp phiên mới nhất lên đầu
        summaries.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(summaries);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/** Tải nội dung chi tiết của một phiên khám */
export async function loadSession(id: string): Promise<PlantDoctorSession | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve((req.result as PlantDoctorSession) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Lưu hoặc cập nhật một phiên khám */
export async function saveSession(session: PlantDoctorSession): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(session);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

/** Xoá vĩnh viễn một phiên khám */
export async function deleteSession(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

/** Đổi tên tiêu đề một phiên khám */
export async function renameSession(id: string, newTitle: string): Promise<void> {
  const existing = await loadSession(id);
  if (!existing) return;
  existing.title = newTitle.trim() || existing.title;
  existing.updatedAt = Date.now();
  await saveSession(existing);
}
