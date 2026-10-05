import { newId, type DoctorImage } from "./api";

const MAX_DIMENSION = 1000;
const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif)$/i;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Thu ảnh về cạnh dài ≤1000px, JPEG 0.75 để gửi AI nhanh và nhẹ (như ALOHA-GARDEN-2). */
export async function prepareImage(file: File): Promise<DoctorImage | null> {
  if (file.type && !ACCEPTED.test(file.type)) return null;
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl).catch(() => null);
  if (!img) return null;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL("image/jpeg", 0.75);
  return { id: newId("img"), previewUrl: out, base64: out.slice(out.indexOf(",") + 1), mimeType: "image/jpeg" };
}
