/**
 * Quét tem QR + mã vạch (đối chiếu mã SP / barcode kho):
 * - Camera: getUserMedia + fallback độ phân giải + autofocus continuous
 * - Decode: BarcodeDetector (nếu có) + ZXing; ROI/jsQR phụ cho tem nhỏ
 * - html5-qrcode vẫn export (dự phòng), đường chính Aloha tự control video (tránh mờ cover)
 */
import type { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

/** Formats dùng cho tem ALOHA: QR (link/?sp=) + mã vạch 1D (mã SP / barcode KV). */
export const SCAN_BARCODE_FORMATS = [
  'qr_code',
  'code_128',
  'code_39',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
] as const;

/**
 * Tỉ lệ cạnh ngắn (dự phòng html5-qrcode). Overlay chính: khung chữ nhật ngang ~2:1.
 */
export const ZALO_SCAN_FRAME_RATIO = 0.72;

/** Khung quét live: rộng × thấp — QR trái + mã vạch ngang (khớp overlay HangHoaList). */
export const SCAN_FRAME_ASPECT = 360 / 168;

/** Lấy mã SP / mã vạch từ nội dung quét (link ?sp= / ?ma= / ?sku= hoặc mã thuần). */
export function parseSpFromScan(raw: string): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  try {
    if (/^https?:\/\//i.test(t) || t.includes('://') || t.includes('?sp=') || t.includes('?ma=')) {
      const u = new URL(t.startsWith('http') ? t : `https://x.local/${t.replace(/^\//, '')}`);
      const sp = (
        u.searchParams.get('sp') ||
        u.searchParams.get('ma') ||
        u.searchParams.get('sku') ||
        u.searchParams.get('code') ||
        u.searchParams.get('barcode') ||
        ''
      ).trim();
      if (sp) return sp;
      // Path /p/{token} — URL ngắn QR, không phải mã SP (resolve qua API)
      if (/^\/p\/[^/?#]+/i.test(u.pathname)) return '';
      // Path kiểu /sp/BX1L
      const pathMa = u.pathname.match(/\/(?:sp|product|sku)\/([^/?#]+)/i);
      if (pathMa?.[1]) {
        try {
          return decodeURIComponent(pathMa[1]).trim();
        } catch {
          return pathMa[1].trim();
        }
      }
    }
  } catch {
    /* không phải URL */
  }
  const m = t.match(/[?&](?:sp|ma|sku|code|barcode)=([^&#\s]+)/i);
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1]).trim();
    } catch {
      return m[1].trim();
    }
  }
  // URL không có ?sp= / /p/ — không coi cả link là mã SP (hay báo «không khớp»).
  if (/^https?:\/\//i.test(t) || t.includes('://')) return '';
  return t.replace(/^MV:\s*/i, '').replace(/^\][A-Za-z]\d/, '').trim();
}

/** Chuỗi quét có phải URL/link (không phải mã SP thuần). */
export function looksLikeScanUrl(s: string): boolean {
  const t = String(s || '').trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t) || t.includes('://')) return true;
  if (/^\/p\/[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4,8}$/i.test(t)) return true;
  return /[?&](?:sp|ma|sku|code|barcode)=/i.test(t);
}

/**
 * Các dạng cùng một lần quét: mã SP, mã vạch KV, UPC 12 số ↔ EAN-13 (thêm/bớt 0).
 */
export function scanCodeLookupKeys(raw: string): string[] {
  let t = String(raw || '')
    .trim()
    .replace(/^\u001d+/, '')
    .replace(/\u001d+/g, '');
  t = t.replace(/^\][A-Za-z]\d/, '').replace(/^MV:\s*/i, '').trim();
  if (!t) return [];
  const keys = new Set<string>([t, t.toUpperCase()]);
  if (/^\d{12}$/.test(t)) keys.add(`0${t}`);
  if (/^\d{13}$/.test(t) && t.startsWith('0')) keys.add(t.slice(1));
  return [...keys].filter(Boolean);
}

type DetectedBarcodeLike = {
  rawValue?: string;
  format?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  cornerPoints?: Array<{ x: number; y: number }>;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcodeLike[]>;
};

export type ScanLockKind = 'qr' | 'barcode';

/** Ô bám mã — toạ độ 0–1 theo khung video đang hiện (object-cover). */
export type ScanLockBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ScanLockKind;
};

let sharedDetector: BarcodeDetectorLike | null | undefined;
let fastDetector: BarcodeDetectorLike | null | undefined;
let zxingPromise: Promise<typeof import('@zxing/browser')> | null = null;
let jsQrMod: typeof import('jsqr') | null = null;
let workCanvas: HTMLCanvasElement | null = null;

function getBarcodeDetector(formats: readonly string[]): BarcodeDetectorLike | null {
  const BD = (globalThis as { BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  if (typeof BD !== 'function') return null;
  try {
    return new BD({ formats: [...formats] });
  } catch {
    try {
      return new BD();
    } catch {
      return null;
    }
  }
}

/** QR + Code128 — tem ALOHA; ít format = nhận diện nhanh như máy quét công ty. */
function getFastDetector(): BarcodeDetectorLike | null {
  if (fastDetector !== undefined) return fastDetector;
  fastDetector = getBarcodeDetector(['qr_code', 'code_128']);
  return fastDetector;
}

function getSharedDetector(): BarcodeDetectorLike | null {
  if (sharedDetector !== undefined) return sharedDetector;
  sharedDetector = getBarcodeDetector(SCAN_BARCODE_FORMATS);
  return sharedDetector;
}

function getWorkCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (w < 8 || h < 8) return null;
  if (!workCanvas) workCanvas = document.createElement('canvas');
  if (workCanvas.width !== w || workCanvas.height !== h) {
    workCanvas.width = w;
    workCanvas.height = h;
  }
  return workCanvas;
}

async function loadZxing() {
  if (!zxingPromise) zxingPromise = import('@zxing/browser');
  return zxingPromise;
}

async function loadJsQr() {
  if (jsQrMod) return jsQrMod;
  jsQrMod = await import('jsqr');
  return jsQrMod;
}

/** Camera sau: 720p — Zalo/Shopee quét nhanh hơn 1080p (decode mỗi khung). */
export function getScanCameraConstraints(): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      ...( { focusMode: { ideal: 'continuous' } } as Record<string, unknown>),
    } as MediaTrackConstraints,
  };
}

const CAMERA_CONSTRAINT_FALLBACKS: MediaStreamConstraints[] = [
  getScanCameraConstraints(),
  {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  },
  {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 24 },
    },
  },
  { audio: false, video: { facingMode: { ideal: 'environment' } } },
  { audio: false, video: { facingMode: 'environment' } },
  { audio: false, video: true },
];

async function pickBackCameraDeviceId(): Promise<string | null> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput' && String(d.label || '').trim());
    if (!cams.length) return null;
    const score = (label: string) => {
      const L = label.toLowerCase();
      if (/back|rear|environment|sau|후면|world/i.test(L)) return 4;
      if (/ultra.?wide|wide|tele/i.test(L) && !/front|user/i.test(L)) return 3;
      if (/front|user|face|selfie|trước/i.test(L)) return 0;
      return 1;
    };
    const sorted = [...cams].sort((a, b) => score(b.label || '') - score(a.label || ''));
    const best = sorted[0];
    if (!best || score(best.label || '') < 1) return null;
    return best.deviceId || null;
  } catch {
    return null;
  }
}

/**
 * Mở camera sau với AF liên tục — chọn đúng camera sau nếu liệt kê được.
 */
export async function openScanCamera(): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw Object.assign(new Error('insecure'), { name: 'SecurityError' });
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
  }

  const backId = await pickBackCameraDeviceId();
  if (backId) {
    const preferred: MediaStreamConstraints[] = [
      {
        audio: false,
        video: {
          deviceId: { exact: backId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          ...({ focusMode: { ideal: 'continuous' } } as Record<string, unknown>),
        } as MediaTrackConstraints,
      },
      {
        audio: false,
        video: {
          deviceId: { exact: backId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      { audio: false, video: { deviceId: { exact: backId } } },
    ];
    for (const c of preferred) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c);
        await applyScanTrackSettings(stream);
        return stream;
      } catch {
        /* thử constraint tiếp */
      }
    }
  }

  let lastErr: unknown;
  for (const constraints of CAMERA_CONSTRAINT_FALLBACKS) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      await applyScanTrackSettings(stream);
      return stream;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Không mở được camera');
}

export type ScanCameraErrorKind =
  | 'permission_denied'
  | 'not_found'
  | 'in_use'
  | 'insecure'
  | 'unsupported'
  | 'unknown';

export function classifyScanCameraError(err: unknown): {
  kind: ScanCameraErrorKind;
  message: string;
} {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      kind: 'insecure',
      message:
        'Trình duyệt chặn camera trên HTTP. Mở app bằng HTTPS (store…) hoặc localhost — hoặc dùng «Chọn ảnh tem».',
    };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      kind: 'unsupported',
      message: 'Máy này không hỗ trợ camera trong trình duyệt. Dùng «Chọn ảnh tem» bên dưới.',
    };
  }
  const name = String((err as { name?: string })?.name || '');
  const msg = String((err as { message?: string })?.message || err || '');
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || /permission|denied|notallowed/i.test(msg)) {
    return {
      kind: 'permission_denied',
      message: 'Camera đang bị chặn. Hãy cấp quyền Camera cho trình duyệt (Chrome → biểu tượng ổ khóa → Camera).',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || /not found|no device/i.test(msg)) {
    return {
      kind: 'not_found',
      message: 'Không tìm thấy camera trên thiết bị.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || /in use|busy|readable/i.test(msg)) {
    return {
      kind: 'in_use',
      message: 'Camera đang bị ứng dụng khác dùng. Đóng app Camera/Zalo rồi thử lại.',
    };
  }
  return {
    kind: 'unknown',
    message: 'Không mở được camera. Cho phép quyền camera, hoặc chọn ảnh tem bên dưới.',
  };
}

export type ScanDebugInfo = {
  resolution: string;
  facing: string;
  focus: string;
  torch: string;
  scanner: string;
  formats: string;
};

export function readScanDebugInfo(
  stream: MediaStream | null,
  scannerLabel = 'ZXing+BarcodeDetector'
): ScanDebugInfo {
  const track = stream?.getVideoTracks()?.[0];
  const settings = (track?.getSettings?.() || {}) as MediaTrackSettings & {
    facingMode?: string;
    focusMode?: string;
  };
  const caps = (track?.getCapabilities?.() || {}) as MediaTrackCapabilities & {
    focusMode?: string[];
    torch?: boolean;
  };
  const w = settings.width || 0;
  const h = settings.height || 0;
  return {
    resolution: w && h ? `${w}x${h}` : '—',
    facing: String(settings.facingMode || 'environment'),
    focus: settings.focusMode || (caps.focusMode?.includes?.('continuous') ? 'continuous?' : 'n/a'),
    torch: caps.torch ? 'supported' : 'no',
    scanner: scannerLabel,
    formats: 'QR, Code128, Code39, EAN-13/8, UPC-A/E',
  };
}

export async function applyScanTrackSettings(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  const caps = (track.getCapabilities?.() || {}) as MediaTrackCapabilities & {
    focusMode?: string[];
    zoom?: { min?: number; max?: number; step?: number };
    exposureMode?: string[];
    pointsOfInterest?: boolean;
  };

  // Một lệnh — AF liên tục kiểu Zalo. Không ép nét macro (làm mờ tem cầm vừa tầm).
  const advanced: Record<string, unknown> = {};
  if (caps.focusMode?.includes?.('continuous')) advanced.focusMode = 'continuous';
  else if (caps.focusMode?.includes?.('single-shot')) advanced.focusMode = 'single-shot';
  if (caps.exposureMode?.includes?.('continuous')) advanced.exposureMode = 'continuous';
  if (typeof caps.zoom?.min === 'number') advanced.zoom = caps.zoom.min;
  try {
    if (Object.keys(advanced).length) {
      await track.applyConstraints({
        advanced: [advanced as MediaTrackConstraintSet],
      });
    }
  } catch {
    try {
      if (advanced.focusMode) {
        await track.applyConstraints({
          advanced: [{ focusMode: advanced.focusMode } as MediaTrackConstraintSet],
        });
      }
    } catch {
      /* ignore */
    }
  }

  void nudgeFocusToFrameCenter(track, caps);
}

/** Điểm nét tâm khung (pointsOfInterest) — Chrome Android; iOS bỏ qua. */
async function nudgeFocusToFrameCenter(
  track: MediaStreamTrack,
  caps?: MediaTrackCapabilities & { pointsOfInterest?: boolean }
): Promise<void> {
  const c =
    caps ||
    ((track.getCapabilities?.() || {}) as MediaTrackCapabilities & { pointsOfInterest?: boolean });
  if (!c.pointsOfInterest) return;
  try {
    await track.applyConstraints({
      advanced: [{ pointsOfInterest: [{ x: 0.5, y: 0.5 }] } as MediaTrackConstraintSet],
    });
  } catch {
    /* ignore */
  }
}

/** Chạm màn: lấy nét lại giữa khung. Không ép nét siêu gần (dễ mờ). */
export async function refocusScanCamera(stream: MediaStream | null): Promise<void> {
  const track = stream?.getVideoTracks()?.[0];
  if (!track?.getCapabilities) return;
  const caps = track.getCapabilities() as MediaTrackCapabilities & {
    focusMode?: string[];
    pointsOfInterest?: boolean;
  };
  await nudgeFocusToFrameCenter(track, caps);
  try {
    if (caps.focusMode?.includes?.('single-shot')) {
      await track.applyConstraints({
        advanced: [{ focusMode: 'single-shot' } as MediaTrackConstraintSet],
      });
    } else if (caps.focusMode?.includes?.('continuous')) {
      await track.applyConstraints({
        advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
      });
      await nudgeFocusToFrameCenter(track, caps);
    }
  } catch {
    /* ignore */
  }
}

/** Vòng AF tự động — giữ nét tâm khung (Chrome Android). iOS: AF hệ thống. */
export function startScanAutoFocusLoop(
  stream: MediaStream | null,
  intervalMs = 1500
): () => void {
  if (!stream) return () => undefined;
  let stopped = false;
  let timer = 0;
  const tick = () => {
    if (stopped) return;
    void refocusScanCamera(stream).finally(() => {
      if (stopped) return;
      timer = window.setTimeout(tick, intervalMs) as unknown as number;
    });
  };
  void refocusScanCamera(stream);
  timer = window.setTimeout(tick, 450) as unknown as number;
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

export function scanTorchSupported(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()?.[0];
  if (!track?.getCapabilities) return false;
  const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
  return caps.torch === true;
}

export async function setScanTorch(stream: MediaStream | null, on: boolean): Promise<boolean> {
  const track = stream?.getVideoTracks()?.[0];
  if (!track) return false;
  try {
    await track.applyConstraints({
      advanced: [{ torch: on } as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    try {
      await track.applyConstraints({ torch: on } as MediaTrackConstraints);
      return true;
    } catch {
      return false;
    }
  }
}

export function scanZoomSupported(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()?.[0];
  if (!track?.getCapabilities) return false;
  const caps = track.getCapabilities() as MediaTrackCapabilities & {
    zoom?: { min?: number; max?: number };
  };
  return typeof caps.zoom?.max === 'number' && caps.zoom.max > 1.15;
}

/** zoomFactor: 1 = xa, 2 = gần hơn trong khả năng máy */
export async function setScanZoom(stream: MediaStream | null, zoomFactor: number): Promise<boolean> {
  const track = stream?.getVideoTracks()?.[0];
  if (!track?.getCapabilities) return false;
  const caps = track.getCapabilities() as MediaTrackCapabilities & {
    zoom?: { min?: number; max?: number };
  };
  if (typeof caps.zoom?.max !== 'number') return false;
  const min = caps.zoom.min ?? 1;
  const max = caps.zoom.max;
  const z = Math.min(max, Math.max(min, zoomFactor));
  try {
    await track.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] });
    return true;
  } catch {
    try {
      await track.applyConstraints({ zoom: z } as MediaTrackConstraints);
      return true;
    } catch {
      return false;
    }
  }
}

/** Rung 2 nhịp (kiểu Zalo) + beep 2 nốt khi quét được. */
export function buzzScanSuccess(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([40, 50, 120]);
    }
  } catch {
    /* ignore */
  }
  playScanBeep();
}

let beepCtx: AudioContext | null = null;

function playScanBeep(): void {
  try {
    const AC =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!AC) return;
    if (!beepCtx) beepCtx = new AC();
    const ctx = beepCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };
    const t = ctx.currentTime;
    beep(880, t, 0.07);
    beep(1320, t + 0.09, 0.08);
  } catch {
    /* ignore */
  }
}

function cropCenter(
  video: HTMLVideoElement,
  ratio: number,
  outSize = 720
): HTMLCanvasElement | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w < 16 || h < 16) return null;
  const side = Math.floor(Math.min(w, h) * Math.min(0.95, Math.max(0.35, ratio)));
  const sx = Math.floor((w - side) / 2);
  const sy = Math.floor((h - side) / 2);
  const size = Math.min(outSize, Math.max(400, side));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

/** Cắt dải ngang giữa khung — mã vạch 1D (CODE128/EAN) dễ đọc hơn ô vuông. */
function cropCenterStrip(
  video: HTMLVideoElement,
  widthRatio = 0.92,
  heightRatio = 0.28,
  maxW = 1280
): HTMLCanvasElement | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w < 16 || h < 16) return null;
  const cw = Math.floor(w * Math.min(0.98, Math.max(0.5, widthRatio)));
  const ch = Math.floor(h * Math.min(0.55, Math.max(0.12, heightRatio)));
  const sx = Math.floor((w - cw) / 2);
  const sy = Math.floor((h - ch) / 2);
  const outW = Math.min(maxW, Math.max(320, cw));
  const outH = Math.max(80, Math.floor((ch / cw) * outW));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, sx, sy, cw, ch, 0, 0, outW, outH);
  return canvas;
}

/**
 * Cắt ô vuông lệch trái khung — tem nhiệt 72×22 có QR nửa trái.
 * biasX: 0 = sát trái vùng giữa-trái, 0.5 = gần giữa.
 */
function cropBiasedSquare(
  video: HTMLVideoElement,
  ratio: number,
  biasX: number,
  outSize = 960
): HTMLCanvasElement | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w < 16 || h < 16) return null;
  const side = Math.floor(Math.min(w, h) * Math.min(0.95, Math.max(0.32, ratio)));
  const maxSx = Math.max(0, w - side);
  const sx = Math.floor(Math.min(maxSx, Math.max(0, maxSx * Math.min(1, Math.max(0, biasX)))));
  const sy = Math.floor((h - side) / 2);
  const size = Math.min(outSize, Math.max(400, side));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

/** ROI vuông khớp khung Zalo (giữa khung hình). */
function cropZaloFrameSquare(
  video: HTMLVideoElement,
  frameRatio = ZALO_SCAN_FRAME_RATIO,
  outSize = 960
): HTMLCanvasElement | null {
  return cropCenter(video, frameRatio, outSize);
}

type VideoRect = { sx: number; sy: number; cw: number; ch: number };

/** Hình chữ nhật giữa video — khớp overlay ngang ~2:1. */
function scanFrameRectInVideo(video: HTMLVideoElement): VideoRect | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w < 16 || h < 16) return null;
  const short = Math.min(w, h);
  const cw = Math.max(80, Math.floor(Math.min(w * 0.96, short * 0.92)));
  const ch = Math.max(48, Math.floor(Math.min(h * 0.72, cw / SCAN_FRAME_ASPECT)));
  return {
    sx: Math.floor((w - cw) / 2),
    sy: Math.floor((h - ch) / 2),
    cw,
    ch,
  };
}

function drawVideoRect(
  video: HTMLVideoElement,
  rect: VideoRect,
  maxW: number
): HTMLCanvasElement | null {
  const outW = Math.min(maxW, Math.max(240, rect.cw));
  const outH = Math.max(48, Math.floor((rect.ch / rect.cw) * outW));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, rect.sx, rect.sy, rect.cw, rect.ch, 0, 0, outW, outH);
  return canvas;
}

function cropScanFrameRect(video: HTMLVideoElement, maxW = 960): HTMLCanvasElement | null {
  const rect = scanFrameRectInVideo(video);
  if (!rect) return null;
  return drawVideoRect(video, rect, maxW);
}

/** Ô vuông nửa trái trong khung ngang — QR tem nhiệt 72×22. */
function cropScanQrLeftInFrame(video: HTMLVideoElement, outSize = 640): HTMLCanvasElement | null {
  const rect = scanFrameRectInVideo(video);
  if (!rect) return null;
  const side = Math.min(rect.ch, Math.floor(rect.cw * 0.48));
  const sub: VideoRect = {
    sx: rect.sx + Math.floor(rect.cw * 0.04),
    sy: rect.sy + Math.floor((rect.ch - side) / 2),
    cw: side,
    ch: side,
  };
  const size = Math.min(outSize, Math.max(280, side));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, sub.sx, sub.sy, sub.cw, sub.ch, 0, 0, size, size);
  return canvas;
}

/**
 * Dải ngang nằm trong khung chữ nhật — Code128/EAN dễ đọc hơn ô vuông.
 * stripHRatio: tỉ lệ chiều cao dải so với chiều cao khung.
 */
function cropBarcodeStripInFrame(
  video: HTMLVideoElement,
  _frameRatio = ZALO_SCAN_FRAME_RATIO,
  stripHRatio = 0.42,
  maxW = 1280
): HTMLCanvasElement | null {
  const rect = scanFrameRectInVideo(video);
  if (!rect) return null;
  const ch = Math.max(36, Math.floor(rect.ch * Math.min(0.7, Math.max(0.22, stripHRatio))));
  const strip: VideoRect = {
    sx: rect.sx,
    sy: rect.sy + Math.floor((rect.ch - ch) / 2),
    cw: rect.cw,
    ch,
  };
  return drawVideoRect(video, strip, maxW);
}

function measureCanvasLuma(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 128;
  const { width, height } = canvas;
  if (width < 4 || height < 4) return 128;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  let sum = 0;
  let n = 0;
  const step = Math.max(4, Math.floor((width * height) / 900));
  for (let p = 0; p < width * height; p += step) {
    const i = p * 4;
    sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    n += 1;
  }
  return n ? sum / n : 128;
}

function lockKindFromFormat(format?: string): ScanLockKind {
  const f = String(format || '').toLowerCase();
  return !f || f.includes('qr') ? 'qr' : 'barcode';
}

function bboxFromDetected(c: DetectedBarcodeLike): QrBBox | null {
  const pts = c.cornerPoints;
  if (pts && pts.length >= 3) {
    let minX = pts[0].x;
    let minY = pts[0].y;
    let maxX = pts[0].x;
    let maxY = pts[0].y;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }
  const b = c.boundingBox;
  if (b && b.width > 0 && b.height > 0) {
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }
  return null;
}

function mapVideoPixelsToElementNorm(
  video: HTMLVideoElement,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
  kind: ScanLockKind
): ScanLockBox | null {
  const elW = video.clientWidth;
  const elH = video.clientHeight;
  const vidW = video.videoWidth;
  const vidH = video.videoHeight;
  if (elW < 8 || elH < 8 || vidW < 8 || vidH < 8) return null;
  const scale = Math.max(elW / vidW, elH / vidH);
  const dispW = vidW * scale;
  const dispH = vidH * scale;
  const ox = (elW - dispW) / 2;
  const oy = (elH - dispH) / 2;
  return {
    x: (vx * scale + ox) / elW,
    y: (vy * scale + oy) / elH,
    w: (vw * scale) / elW,
    h: (vh * scale) / elH,
    kind,
  };
}

function mapRoiBBoxToLock(
  video: HTMLVideoElement,
  rect: VideoRect,
  canvas: HTMLCanvasElement,
  bbox: QrBBox,
  kind: ScanLockKind
): ScanLockBox | null {
  const sx = rect.cw / canvas.width;
  const sy = rect.ch / canvas.height;
  return mapVideoPixelsToElementNorm(
    video,
    rect.sx + bbox.x * sx,
    rect.sy + bbox.y * sy,
    bbox.w * sx,
    bbox.h * sy,
    kind
  );
}

type LiveScanHit = { raw: string; lock: ScanLockBox | null };

function pointInPaddedRect(x: number, y: number, rect: VideoRect, pad = 0.12): boolean {
  const px = rect.cw * pad;
  const py = rect.ch * pad;
  return x >= rect.sx - px && x <= rect.sx + rect.cw + px && y >= rect.sy - py && y <= rect.sy + rect.ch + py;
}

function cloneCanvasBoosted(source: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.drawImage(source, 0, 0);
    boostContrastInPlace(c, factor);
  }
  return c;
}

/** Tăng tương phản + xám — tem nhiệt / QR nhỏ dễ đọc hơn. */
function boostContrastInPlace(canvas: HTMLCanvasElement, factor = 1.45): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const intercept = 128 * (1 - factor);
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, y * factor + intercept));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

/** Nhị phân Otsu đơn giản — tem nhiệt in đậm / chụp lệch sáng. */
function binarizeInPlace(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hist = new Array<number>(256).fill(0);
  const gray = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    gray[j] = y;
    hist[y]++;
  }
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > maxVar) {
      maxVar = v;
      threshold = t;
    }
  }
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = gray[j] > threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

export type QrBBox = { x: number; y: number; w: number; h: number };

export type QrDetection = {
  raw: string;
  bbox: QrBBox;
  /** Ảnh QR đã cắt + phóng to — xem trước / decode lại */
  croppedCanvas?: HTMLCanvasElement;
};

function bboxFromJsQrLocation(loc: {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
}): QrBBox {
  const xs = [
    loc.topLeftCorner.x,
    loc.topRightCorner.x,
    loc.bottomLeftCorner.x,
    loc.bottomRightCorner.x,
  ];
  const ys = [
    loc.topLeftCorner.y,
    loc.topRightCorner.y,
    loc.bottomLeftCorner.y,
    loc.bottomRightCorner.y,
  ];
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxX = Math.ceil(Math.max(...xs));
  const maxY = Math.ceil(Math.max(...ys));
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function expandBBox(bbox: QrBBox, canvasW: number, canvasH: number, padRatio = 0.14): QrBBox {
  const padX = Math.ceil(bbox.w * padRatio);
  const padY = Math.ceil(bbox.h * padRatio);
  const x = Math.max(0, bbox.x - padX);
  const y = Math.max(0, bbox.y - padY);
  const w = Math.min(canvasW - x, bbox.w + padX * 2);
  const h = Math.min(canvasH - y, bbox.h + padY * 2);
  return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
}

/** Cắt vùng QR + phóng to tối thiểu minSide px (giữ nét module). */
export function cropAndScaleQrRegion(
  source: HTMLCanvasElement,
  bbox: QrBBox,
  minSide = 320
): HTMLCanvasElement {
  const pad = expandBBox(bbox, source.width, source.height);
  const side = Math.max(pad.w, pad.h);
  const outSize = Math.max(minSide, Math.min(720, side * 2));
  const out = document.createElement('canvas');
  out.width = outSize;
  out.height = outSize;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return source;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, outSize, outSize);
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(outSize / pad.w, outSize / pad.h);
  const dw = pad.w * scale;
  const dh = pad.h * scale;
  const dx = (outSize - dw) / 2;
  const dy = (outSize - dh) / 2;
  ctx.drawImage(source, pad.x, pad.y, pad.w, pad.h, dx, dy, dw, dh);
  return out;
}

function maskRegionWhite(canvas: HTMLCanvasElement, bbox: QrBBox, padRatio = 0.08): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const pad = expandBBox(bbox, canvas.width, canvas.height, padRatio);
  ctx.fillStyle = '#fff';
  ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
}

function splitCanvasHalves(canvas: HTMLCanvasElement): HTMLCanvasElement[] {
  const w = canvas.width;
  const h = canvas.height;
  if (w < 32 || h < 32) return [];
  const mid = Math.floor(w / 2);
  const halves: HTMLCanvasElement[] = [];
  for (const [sx, sw] of [
    [0, mid],
    [mid, w - mid],
  ] as const) {
    const c = document.createElement('canvas');
    c.width = sw;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;
    ctx.drawImage(canvas, sx, 0, sw, h, 0, 0, sw, h);
    halves.push(c);
  }
  return halves;
}

async function tryJsQrCanvasDetailed(
  canvas: HTMLCanvasElement,
  offsetX = 0,
  offsetY = 0
): Promise<QrDetection | null> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const jsQR = (await loadJsQr()).default;
  const hit = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
  if (!hit?.data || !hit.location) return null;
  const local = bboxFromJsQrLocation(hit.location);
  const bbox: QrBBox = {
    x: local.x + offsetX,
    y: local.y + offsetY,
    w: local.w,
    h: local.h,
  };
  const cropped = cropAndScaleQrRegion(canvas, local);
  return { raw: hit.data, bbox, croppedCanvas: cropped };
}

async function tryJsQrCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  const d = await tryJsQrCanvasDetailed(canvas);
  return d?.raw || null;
}

async function tryNative(source: ImageBitmapSource): Promise<string | null> {
  const detector = getSharedDetector();
  if (!detector) return null;
  try {
    const codes = await detector.detect(source);
    for (const c of codes || []) {
      const raw = c?.rawValue;
      if (raw) return String(raw);
    }
    return null;
  } catch {
    return null;
  }
}

async function tryNativeDetailed(
  source: ImageBitmapSource
): Promise<{ raw: string; format?: string; bbox: QrBBox | null } | null> {
  const detector = getSharedDetector();
  if (!detector) return null;
  try {
    const codes = await detector.detect(source);
    for (const c of codes || []) {
      const raw = c?.rawValue;
      if (!raw) continue;
      return { raw: String(raw), format: c.format, bbox: bboxFromDetected(c) };
    }
    return null;
  } catch {
    return null;
  }
}

function sourceDimensions(source: ImageBitmapSource): { w: number; h: number } {
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { w: source.width, h: source.height };
  }
  if (source instanceof HTMLCanvasElement) {
    return { w: source.width, h: source.height };
  }
  if (source instanceof HTMLVideoElement) {
    return { w: source.videoWidth, h: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { w: source.naturalWidth || source.width, h: source.naturalHeight || source.height };
  }
  return { w: 0, h: 0 };
}

/** Native QR + mã vạch — nhanh như app công ty (1 lần đọc, nhiều mã). */
async function detectAllNativeFromSource(source: ImageBitmapSource): Promise<QrDetection[]> {
  const { w, h } = sourceDimensions(source);
  const fallback: QrBBox = { x: 0, y: 0, w: Math.max(1, w), h: Math.max(1, h) };
  const seen = new Set<string>();
  const out: QrDetection[] = [];
  const tried = new Set<BarcodeDetectorLike>();
  for (const detector of [getFastDetector(), getSharedDetector()]) {
    if (!detector || tried.has(detector)) continue;
    tried.add(detector);
    try {
      const codes = await detector.detect(source);
      for (const c of codes || []) {
        const raw = String(c?.rawValue || '').trim();
        if (!raw || seen.has(raw)) continue;
        seen.add(raw);
        const bbox = bboxFromDetected(c);
        out.push({ raw, bbox: bbox || fallback });
      }
    } catch {
      /* máy không hỗ trợ nguồn này */
    }
  }
  return out;
}

async function bitmapFromFile(file: File, maxSide = 1280): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  const base: ImageBitmapOptions = { imageOrientation: 'from-image', resizeQuality: 'high' };
  try {
    return await createImageBitmap(file, { ...base, resizeWidth: maxSide });
  } catch {
    try {
      return await createImageBitmap(file, base);
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        return null;
      }
    }
  }
}

async function canvasFromFile(file: File, maxSide = 960): Promise<HTMLCanvasElement | null> {
  const bmp = await bitmapFromFile(file, maxSide);
  if (bmp) {
    const canvas = getWorkCanvas(bmp.width, bmp.height);
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (canvas && ctx) {
      ctx.drawImage(bmp, 0, 0);
      try {
        bmp.close();
      } catch {
        /* ignore */
      }
      return canvas;
    }
    try {
      bmp.close();
    } catch {
      /* ignore */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không đọc được ảnh'));
      el.src = url;
    });
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(iw, ih));
    const w = Math.max(1, Math.floor(iw * scale));
    const h = Math.max(1, Math.floor(ih * scale));
    const canvas = getWorkCanvas(w, h);
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** jsQR nhẹ — 1–3 lần thử, không chạy full pipeline nặng. */
async function fastJsQrFromCanvas(canvas: HTMLCanvasElement): Promise<QrDetection[]> {
  const seen = new Set<string>();
  const out: QrDetection[] = [];
  const push = (d: QrDetection | null) => {
    if (!d?.raw || seen.has(d.raw)) return;
    seen.add(d.raw);
    out.push(d);
  };

  push(await tryJsQrCanvasDetailed(canvas));
  if (out.length) return out;

  const roi = cropCenter(canvas, 0.72, 720);
  if (roi) push(await tryJsQrCanvasDetailed(roi));
  if (out.length) return out;

  for (const half of splitCanvasHalves(canvas)) {
    push(await tryJsQrCanvasDetailed(half));
  }
  if (out.length) return out;

  const boosted = cloneCanvasBoosted(canvas, 1.45);
  push(await tryJsQrCanvasDetailed(boosted));
  return out;
}

/**
 * Tự tìm QR trong ảnh: bounding box → cắt → phóng to → thử decode lại.
 * Hỗ trợ ảnh chụp 2 tem cùng hàng (trái/phải) và tem in đậm.
 */
export async function detectQrsInCanvas(canvas: HTMLCanvasElement): Promise<QrDetection[]> {
  const found: QrDetection[] = [];
  const seenRaw = new Set<string>();

  const push = (d: QrDetection | null) => {
    if (!d?.raw) return;
    const t = String(d.raw).trim();
    if (!t || seenRaw.has(t)) return;
    seenRaw.add(t);
    found.push(d);
  };

  const scanOne = async (c: HTMLCanvasElement, ox = 0, oy = 0) => {
    push(await tryJsQrCanvasDetailed(c, ox, oy));
    const boosted = document.createElement('canvas');
    boosted.width = c.width;
    boosted.height = c.height;
    const bctx = boosted.getContext('2d', { willReadFrequently: true });
    if (bctx) {
      bctx.drawImage(c, 0, 0);
      boostContrastInPlace(boosted, 1.55);
      push(await tryJsQrCanvasDetailed(boosted, ox, oy));
      const bin = document.createElement('canvas');
      bin.width = c.width;
      bin.height = c.height;
      const bctx2 = bin.getContext('2d', { willReadFrequently: true });
      if (bctx2) {
        bctx2.drawImage(c, 0, 0);
        boostContrastInPlace(bin, 1.35);
        binarizeInPlace(bin);
        push(await tryJsQrCanvasDetailed(bin, ox, oy));
      }
    }
  };

  await scanOne(canvas);

  // Ảnh chụp 2 tem / dải ngang — quét nửa trái + nửa phải
  const mid = Math.floor(canvas.width / 2);
  for (const [half, ox] of splitCanvasHalves(canvas).map((h, i) => [h, i === 0 ? 0 : mid] as const)) {
    await scanOne(half, ox, 0);
  }

  // Tìm QR thứ 2: che vùng đã thấy rồi quét lại
  if (found.length) {
    const masked = document.createElement('canvas');
    masked.width = canvas.width;
    masked.height = canvas.height;
    const mctx = masked.getContext('2d', { willReadFrequently: true });
    if (mctx) {
      mctx.drawImage(canvas, 0, 0);
      for (const f of found) maskRegionWhite(masked, f.bbox);
      await scanOne(masked);
      for (const [half, ox] of splitCanvasHalves(masked).map((h, i) => [h, i === 0 ? 0 : mid] as const)) {
        await scanOne(half, ox, 0);
      }
    }
  }

  // Decode lại trên ảnh đã cắt/phóng to (tem nhỏ / mờ)
  for (const f of [...found]) {
    if (!f.croppedCanvas) continue;
    const cropped = f.croppedCanvas;
    const reNative = await tryNative(cropped);
    if (reNative && !seenRaw.has(reNative)) {
      seenRaw.add(reNative);
      found.push({ raw: reNative, bbox: f.bbox, croppedCanvas: cropped });
    }
    const reJs = await tryJsQrCanvas(cropped);
    if (reJs && !seenRaw.has(reJs)) {
      seenRaw.add(reJs);
      found.push({ raw: reJs, bbox: f.bbox, croppedCanvas: cropped });
    }
    const hard = document.createElement('canvas');
    hard.width = cropped.width;
    hard.height = cropped.height;
    const hctx = hard.getContext('2d', { willReadFrequently: true });
    if (hctx) {
      hctx.drawImage(cropped, 0, 0);
      binarizeInPlace(hard);
      const reBin = await tryJsQrCanvas(hard);
      if (reBin && !seenRaw.has(reBin)) {
        seenRaw.add(reBin);
        found.push({ raw: reBin, bbox: f.bbox, croppedCanvas: hard });
      }
    }
  }

  if (!found.length) {
    const native = await tryNative(canvas);
    if (native) found.push({ raw: native, bbox: { x: 0, y: 0, w: canvas.width, h: canvas.height } });
  }

  return found;
}

/** Tự phát hiện QR từ file ảnh — native trước (đọc liền), jsQR nặng chỉ khi miss. */
export async function decodeAllQrsFromImageFile(file: File): Promise<QrDetection[]> {
  // 1) ImageBitmap thu nhỏ — Chrome/Android đọc liền (kiểu Zalo chụp xong)
  const bmp = await bitmapFromFile(file, 1280);
  if (bmp) {
    try {
      const nativeHits = await detectAllNativeFromSource(bmp);
      if (nativeHits.length) return nativeHits;
    } finally {
      try {
        bmp.close();
      } catch {
        /* ignore */
      }
    }
  }

  // 2) Canvas ~960px + native lần nữa (một số máy không detect ImageBitmap)
  const canvas = await canvasFromFile(file, 960);
  if (canvas) {
    const nativeHits = await detectAllNativeFromSource(canvas);
    if (nativeHits.length) return nativeHits;

    // 3) jsQR nhanh — vài ROI, không chạy full detectQrsInCanvas
    const quick = await fastJsQrFromCanvas(canvas);
    if (quick.length) return quick;

    // 4) Tem khó — pipeline đầy đủ (chậm, chỉ khi thật sự miss)
    return detectQrsInCanvas(canvas);
  }

  return [];
}

/** Data URL preview vùng QR đã cắt (hiển thị trong UI quét). */
export function qrDetectionPreviewDataUrl(det: QrDetection): string | undefined {
  if (!det.croppedCanvas) return undefined;
  try {
    return det.croppedCanvas.toDataURL('image/png');
  } catch {
    return undefined;
  }
}

/** Decode 1 frame — native → auto-detect QR → ROI vuông → dải ngang mã vạch. */
export async function decodeQrFromVideoFrame(video: HTMLVideoElement): Promise<string | null> {
  if (video.readyState < 2 || video.videoWidth < 16) return null;

  const direct = await tryNative(video);
  if (direct) return direct;

  // Auto-detect QR trên full frame (tem nhiệt / 2 tem trong khung)
  const full = document.createElement('canvas');
  full.width = video.videoWidth;
  full.height = video.videoHeight;
  const fctx = full.getContext('2d', { willReadFrequently: true });
  if (fctx) {
    fctx.drawImage(video, 0, 0);
    const hits = await detectQrsInCanvas(full);
    if (hits[0]?.raw) return hits[0].raw;
  }

  for (const ratio of [0.55, 0.72, 0.88]) {
    const roi = cropCenter(video, ratio, 720);
    if (!roi) continue;
    const hits = await detectQrsInCanvas(roi);
    if (hits[0]?.raw) return hits[0].raw;
    const n = await tryNative(roi);
    if (n) return n;
  }

  // Mã vạch 1D nằm ngang giữa khung
  for (const [wr, hr] of [
    [0.92, 0.22],
    [0.88, 0.32],
  ] as const) {
    const strip = cropCenterStrip(video, wr, hr, 1280);
    if (!strip) continue;
    const n = await tryNative(strip);
    if (n) return n;
    boostContrastInPlace(strip);
    const n2 = await tryNative(strip);
    if (n2) return n2;
  }

  const hard = cropCenter(video, 0.62, 720);
  if (hard) {
    boostContrastInPlace(hard);
    const hits = await detectQrsInCanvas(hard);
    if (hits[0]?.raw) return hits[0].raw;
  }

  return null;
}

export function cropCenterRoi(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  ratio = 0.62
): HTMLCanvasElement | null {
  const w =
    'videoWidth' in source && source.videoWidth
      ? source.videoWidth
      : 'naturalWidth' in source && source.naturalWidth
        ? source.naturalWidth
        : (source as HTMLCanvasElement).width;
  const h =
    'videoHeight' in source && source.videoHeight
      ? source.videoHeight
      : 'naturalHeight' in source && source.naturalHeight
        ? source.naturalHeight
        : (source as HTMLCanvasElement).height;
  if (w < 16 || h < 16) return null;
  const side = Math.floor(Math.min(w, h) * Math.min(0.95, Math.max(0.35, ratio)));
  const sx = Math.floor((w - side) / 2);
  const sy = Math.floor((h - side) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source as CanvasImageSource, sx, sy, side, side, 0, 0, side, side);
  return canvas;
}

export async function decodeQrFromCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  const hits = await detectQrsInCanvas(canvas);
  if (hits[0]?.raw) return hits[0].raw;
  const n = await tryNative(canvas);
  if (n) return n;
  boostContrastInPlace(canvas);
  const hits2 = await detectQrsInCanvas(canvas);
  return hits2[0]?.raw || null;
}

export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  const all = await decodeAllQrsFromImageFile(file);
  return all[0]?.raw || null;
}

export type ContinuousScanHandle = { stop: () => void };

export type ContinuousScanOptions = {
  /** Gọi khi nhiều frame liên tiếp không đọc được mã (để UI hiện gợi ý). */
  onMiss?: (missStreak: number) => void;
  /** Tỉ lệ khung vuông giữa (mặc định = overlay Zalo 0.72). */
  frameRatio?: number;
  /** Ô xanh bám góc QR / mã vạch — null khi mất mã. */
  onLock?: (box: ScanLockBox | null) => void;
  /** Độ sáng ROI (0–255) — UI tự bật đèn khi tối. */
  onDark?: (luma: number) => void;
};

/**
 * Quét kiểu web công ty (html5-qrcode) — QR + mã vạch 1D.
 * Tự mở camera sau, fps cao. Trả thêm getStream để bật đèn.
 */
export async function startCompanyStyleQrScan(
  elementId: string,
  onHit: (raw: string) => void
): Promise<ContinuousScanHandle & { getStream: () => MediaStream | null }> {
  const mod = await import('html5-qrcode');
  const Html5Qrcode = mod.Html5Qrcode;
  const Formats = mod.Html5QrcodeSupportedFormats;

  const host = document.getElementById(elementId);
  if (!host) throw new Error('Không tìm thấy khung camera quét');

  const scanner = new Html5Qrcode(elementId, {
    formatsToSupport: [
      Formats.QR_CODE,
      Formats.CODE_128,
      Formats.CODE_39,
      Formats.EAN_13,
      Formats.EAN_8,
      Formats.UPC_A,
      Formats.UPC_E,
    ],
    verbose: false,
  });

  let stopped = false;
  let lastText = '';
  let lastAt = 0;
  const emit = (raw: string) => {
    const t = String(raw || '').trim();
    if (!t || stopped) return;
    const now = Date.now();
    if (t === lastText && now - lastAt < 1000) return;
    lastText = t;
    lastAt = now;
    buzzScanSuccess();
    onHit(t);
  };

  const config = {
    fps: 12,
    // Khung vuông giữa kiểu Zalo — khớp ZALO_SCAN_FRAME_RATIO
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
      const side = Math.max(
        200,
        Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * ZALO_SCAN_FRAME_RATIO)
      );
      return {
        width: Math.min(side, viewfinderWidth - 12),
        height: Math.min(side, viewfinderHeight - 12),
      };
    },
    disableFlip: false,
  };

  const camConfig: MediaTrackConstraints = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  };

  try {
    await scanner.start(camConfig, config, (decodedText) => emit(decodedText), () => {});
  } catch {
    try {
      await scanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => emit(decodedText),
        () => {}
      );
    } catch {
      const cameras = await Html5Qrcode.getCameras();
      const back =
        cameras.find((c) => /back|rear|environment|sau|후면/i.test(c.label || '')) ||
        cameras[cameras.length - 1] ||
        cameras[0];
      if (!back?.id) throw new Error('Không có camera');
      await scanner.start(back.id, config, (decodedText) => emit(decodedText), () => {});
    }
  }

  const pickStream = (): MediaStream | null => {
    const v = host.querySelector('video') as HTMLVideoElement | null;
    if (v) {
      v.setAttribute('playsinline', 'true');
      v.setAttribute('webkit-playsinline', 'true');
      v.style.width = '100%';
      v.style.height = '100%';
      v.style.objectFit = 'cover';
      // Tránh scale CSS làm mềm nét
      v.style.transform = 'none';
      v.style.filter = 'none';
    }
    const s = v?.srcObject;
    return s instanceof MediaStream ? s : null;
  };

  // Đợi video sẵn rồi mới chỉnh focus (ngắn — tránh chậm ~350ms trước khi quét)
  await new Promise((r) => setTimeout(r, 100));
  let stream0 = pickStream();
  if (stream0) {
    await applyScanTrackSettings(stream0);
    void refocusScanCamera(stream0);
  }

  let refocusTimer = 0;
  const scheduleRefocus = () => {
    refocusTimer = window.setTimeout(() => {
      if (stopped) return;
      void refocusScanCamera(pickStream());
      scheduleRefocus();
    }, 2800) as unknown as number;
  };
  scheduleRefocus();

  // Chạm video → lấy nét lại
  const onTap = () => {
    void refocusScanCamera(pickStream());
  };
  host.addEventListener('click', onTap);
  host.addEventListener('touchend', onTap, { passive: true });

  return {
    getStream: pickStream,
    stop: () => {
      stopped = true;
      if (refocusTimer) clearTimeout(refocusTimer);
      host.removeEventListener('click', onTap);
      host.removeEventListener('touchend', onTap);
      void (async () => {
        try {
          if (scanner.isScanning) await scanner.stop();
        } catch {
          /* ignore */
        }
        try {
          scanner.clear();
        } catch {
          /* ignore */
        }
      })();
    },
  };
}

/**
 * Quét liên tục chính — native BarcodeDetector trước (QR + mã vạch 1 khung).
 * jsQR / boost chỉ khi miss. Cùng mã cooldown ~900ms; mã khác qua ngay.
 */
export async function startContinuousQrScan(
  video: HTMLVideoElement,
  stream: MediaStream,
  onHit: (raw: string) => void,
  options?: ContinuousScanOptions
): Promise<ContinuousScanHandle> {
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  if (!video.srcObject) video.srcObject = stream;
  try {
    await video.play();
  } catch {
    /* gesture */
  }

  const frameRatio = Math.min(
    0.9,
    Math.max(0.5, Number(options?.frameRatio) || ZALO_SCAN_FRAME_RATIO)
  );

  let stopped = false;
  let lastText = '';
  let lastAt = 0;
  const SAME_CODE_COOLDOWN_MS = 900;
  const onMiss = options?.onMiss;
  const onLock = options?.onLock;
  const onDark = options?.onDark;
  let lockMiss = 0;

  const setLock = (box: ScanLockBox | null) => {
    if (!box) {
      lockMiss += 1;
      if (lockMiss < 3) return;
    } else {
      lockMiss = 0;
    }
    try {
      onLock?.(box);
    } catch {
      /* ignore */
    }
  };

  const emit = (raw: string, lock?: ScanLockBox | null) => {
    const t = String(raw || '').trim();
    if (!t || stopped) return;
    const now = Date.now();
    if (t === lastText && now - lastAt < SAME_CODE_COOLDOWN_MS) {
      if (lock) setLock(lock);
      return;
    }
    lastText = t;
    lastAt = now;
    if (lock) setLock(lock);
    buzzScanSuccess();
    onHit(t);
  };

  async function detectSource(
    detector: BarcodeDetectorLike | null,
    source: ImageBitmapSource
  ): Promise<LiveScanHit | null> {
    if (!detector) return null;
    try {
      const codes = await detector.detect(source);
      for (const c of codes || []) {
        const raw = c?.rawValue;
        if (!raw) continue;
        const bbox = bboxFromDetected(c);
        const kind = lockKindFromFormat(c.format);
        const lock = bbox
          ? mapVideoPixelsToElementNorm(video, bbox.x, bbox.y, bbox.w, bbox.h, kind)
          : null;
        return { raw: String(raw), lock };
      }
    } catch {
      /* một số máy không detect nguồn này */
    }
    return null;
  }

  async function nativeOnVideo(): Promise<LiveScanHit | null> {
    const fast = getFastDetector() || getSharedDetector();
    const all = getSharedDetector();
    if (typeof createImageBitmap === 'function') {
      try {
        const bmp = await createImageBitmap(video);
        try {
          const hit = await detectSource(fast, bmp);
          if (hit) return hit;
          if (all && all !== fast) return await detectSource(all, bmp);
        } finally {
          try {
            bmp.close();
          } catch {
            /* ignore */
          }
        }
        return null;
      } catch {
        /* ImageBitmap từ video không hỗ trợ — detect trực tiếp */
      }
    }
    const hit = await detectSource(fast, video);
    if (hit) return hit;
    if (all && all !== fast) return detectSource(all, video);
    return null;
  }

  async function nativeOnDownscale(): Promise<LiveScanHit | null> {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw < 16 || vh < 16) return null;
    const maxSide = 960;
    const scale = Math.min(1, maxSide / Math.max(vw, vh));
    const w = Math.max(8, Math.round(vw * scale));
    const h = Math.max(8, Math.round(vh * scale));
    const canvas = getWorkCanvas(w, h);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(video, 0, 0, w, h);
    const fast = getFastDetector();
    let hit = await detectSource(fast, canvas);
    if (hit) return hit;
    return detectSource(getSharedDetector(), canvas);
  }

  async function nativeOnCanvas(
    canvas: HTMLCanvasElement | null,
    rect: VideoRect | null
  ): Promise<LiveScanHit | null> {
    if (!canvas) return null;
    const d = await tryNativeDetailed(canvas);
    if (!d) return null;
    const kind = lockKindFromFormat(d.format);
    const lock =
      rect && d.bbox ? mapRoiBBoxToLock(video, rect, canvas, d.bbox, kind) : null;
    return { raw: d.raw, lock };
  }

  async function hardQrPass(): Promise<LiveScanHit | null> {
    const left = cropScanQrLeftInFrame(video, 640);
    if (left) {
      const hits = await detectQrsInCanvas(left);
      if (hits[0]?.raw) {
        const rect = scanFrameRectInVideo(video);
        const side = rect ? Math.min(rect.ch, Math.floor(rect.cw * 0.48)) : 0;
        const lock =
          rect && hits[0].bbox && side
            ? mapRoiBBoxToLock(
                video,
                {
                  sx: rect.sx + Math.floor(rect.cw * 0.04),
                  sy: rect.sy + Math.floor((rect.ch - side) / 2),
                  cw: side,
                  ch: side,
                },
                left,
                hits[0].bbox,
                'qr'
              )
            : null;
        return { raw: hits[0].raw, lock };
      }
    }
    const frame = cropScanFrameRect(video, 720);
    if (frame) {
      const hits = await detectQrsInCanvas(frame);
      if (hits[0]?.raw) {
        const rect = scanFrameRectInVideo(video);
        const lock =
          rect && hits[0].bbox
            ? mapRoiBBoxToLock(video, rect, frame, hits[0].bbox, 'qr')
            : null;
        return { raw: hits[0].raw, lock };
      }
    }
    return null;
  }

  const hasNative = !!(getFastDetector() || getSharedDetector());
  let controls: IScannerControls | null = null;
  let reader: BrowserMultiFormatReader | null = null;
  let timer = 0;
  let busy = false;
  let missStreak = 0;
  let lastMissNotify = 0;

  const noteMiss = () => {
    missStreak = Math.min(60, missStreak + 1);
    setLock(null);
    if (onMiss && missStreak >= 8 && missStreak - lastMissNotify >= 12) {
      lastMissNotify = missStreak;
      try {
        onMiss(missStreak);
      } catch {
        /* ignore */
      }
    }
  };

  const tickFast = async () => {
    if (stopped) return;
    if (!busy && video.readyState >= 2 && video.videoWidth > 16) {
      busy = true;
      try {
        let hit = await nativeOnVideo();
        if (!hit && missStreak >= 2) hit = await nativeOnDownscale();
        if (!hit && missStreak >= 6) {
          const rect = scanFrameRectInVideo(video);
          const frame = rect ? cropScanFrameRect(video, 640) : null;
          hit = await nativeOnCanvas(frame, rect);
          if (!hit) {
            const strip = rect ? cropBarcodeStripInFrame(video, frameRatio, 0.42, 800) : null;
            hit = await nativeOnCanvas(strip, rect);
          }
        }
        if (!hit && missStreak >= 14 && missStreak % 4 === 0) {
          hit = await hardQrPass();
        }

        if (hit?.raw) {
          missStreak = 0;
          lastMissNotify = 0;
          emit(hit.raw, hit.lock);
        } else {
          if (onDark && missStreak > 0 && missStreak % 10 === 0) {
            const sample = cropScanFrameRect(video, 120);
            if (sample) {
              try {
                onDark(measureCanvasLuma(sample));
              } catch {
                /* ignore */
              }
            }
          }
          noteMiss();
        }
      } catch {
        noteMiss();
      } finally {
        busy = false;
      }
    }
    scheduleNext();
  };

  const scheduleNext = () => {
    if (stopped) return;
    const rvfc = (
      video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
      }
    ).requestVideoFrameCallback;
    if (typeof rvfc === 'function') {
      timer = rvfc.call(video, () => {
        void tickFast();
      }) as unknown as number;
      return;
    }
    timer = window.requestAnimationFrame(() => {
      void tickFast();
    }) as unknown as number;
  };

  if (hasNative) {
    scheduleNext();
  } else {
    let zxingOk = false;
    try {
      const { BrowserMultiFormatReader } = await loadZxing();
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, false);
      reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 40,
        delayBetweenScanSuccess: 700,
      });
      controls = await reader.decodeFromStream(stream, video, (result, err) => {
        if (result) {
          missStreak = 0;
          lastMissNotify = 0;
          emit(result.getText());
        }
        void err;
      });
      zxingOk = true;
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[scan] ZXing continuous lỗi, dùng vòng ROI:', e);
    }

    if (!zxingOk) {
      timer = window.setTimeout(() => {
        void tickFast();
      }, 80) as unknown as number;
    }
  }

  return {
    stop: () => {
      stopped = true;
      if (timer) {
        cancelAnimationFrame(timer);
        clearTimeout(timer);
        try {
          (
            video as HTMLVideoElement & {
              cancelVideoFrameCallback?: (id: number) => void;
            }
          ).cancelVideoFrameCallback?.(timer);
        } catch {
          /* ignore */
        }
        timer = 0;
      }
      try {
        controls?.stop();
      } catch {
        /* ignore */
      }
      try {
        (reader as { reset?: () => void } | null)?.reset?.();
      } catch {
        /* ignore */
      }
      try {
        onLock?.(null);
      } catch {
        /* ignore */
      }
    },
  };
}

export function prefetchQrDecoders() {
  void loadZxing();
  void loadJsQr();
  getFastDetector();
  getSharedDetector();
}
