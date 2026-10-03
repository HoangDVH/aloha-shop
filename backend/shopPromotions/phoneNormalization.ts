import crypto from "crypto";

export interface PhoneNormalizationResult {
  valid: boolean;
  normalized?: string; // Định dạng quốc tế chuẩn E.164: +84901234567
  localPhone?: string; // Định dạng nội địa: 0901234567
  error?: string;
}

/**
 * Chuẩn hóa số điện thoại di động Việt Nam về dạng E.164 (+84xxxxxxxxx).
 * Chỉ chấp nhận các đầu số hợp lệ (03, 05, 07, 08, 09) với 10 chữ số.
 * Tuyệt đối không biến số lỗi thành khóa rỗng dùng chung (docs/KE_HOACH_CHONG_LAM_DUNG_UU_DAI_KHONG_OTP.md mục 5.1).
 */
export function normalizeVietnamesePhone(raw: string): PhoneNormalizationResult {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return { valid: false, error: "Số điện thoại không được để trống" };
  }

  // Loại bỏ các ký tự phân tách: khoảng trắng, dấu chấm, gạch ngang, ngoặc đơn
  let digits = trimmed.replace(/[\s\.\-\(\)]/g, "");

  // Xử lý tiền tố quốc tế
  if (digits.startsWith("+84")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("84") && digits.length >= 11) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  } else {
    return {
      valid: false,
      error: "Số điện thoại phải bắt đầu bằng 0, 84 hoặc +84",
    };
  }

  // Kiểm tra chỉ chứa các chữ số
  if (!/^\d+$/.test(digits)) {
    return { valid: false, error: "Số điện thoại chỉ được chứa chữ số" };
  }

  // Số di động VN sau khi bỏ 0/+84 phải có đúng 9 chữ số và bắt đầu bằng [3, 5, 7, 8, 9]
  if (digits.length !== 9 || !/^[35789]/.test(digits)) {
    return {
      valid: false,
      error: "Số điện thoại không đúng định dạng di động 10 số tại Việt Nam",
    };
  }

  const normalized = `+84${digits}`;
  const localPhone = `0${digits}`;

  return {
    valid: true,
    normalized,
    localPhone,
  };
}

/**
 * Che bớt số điện thoại cho mục đích hiển thị vận hành / admin / CTV (mục 5.1, 9.2).
 * Ví dụ: 0901234567 -> 090****567 hoặc +84901234567 -> +8490****567
 */
export function maskPhone(phone: string): string {
  const s = String(phone || "").trim();
  if (!s) return "";
  if (s.length <= 6) return "***";

  if (s.startsWith("+84") && s.length >= 12) {
    const prefix = s.slice(0, 5); // +8490
    const suffix = s.slice(-3); // 567
    return `${prefix}****${suffix}`;
  }

  const prefix = s.slice(0, 3);
  const suffix = s.slice(-3);
  return `${prefix}****${suffix}`;
}

/**
 * Sinh khóa tra cứu HMAC có secret và keyVersion (mục 10).
 * Tránh lưu trữ số điện thoại rõ tại các bảng khóa tra cứu mở rộng.
 */
export function computePhoneHmacKey(
  phoneNormalized: string,
  secret = process.env.PHONE_HMAC_SECRET || "aloha-phone-identity-key-default-salt",
  keyVersion = "v1"
): string {
  const norm = String(phoneNormalized || "").trim();
  if (!norm) {
    throw new Error("Không thể tạo HMAC key cho số điện thoại rỗng");
  }
  const hmac = crypto.createHmac("sha256", secret).update(`${keyVersion}:${norm}`).digest("hex");
  return `hmac_${keyVersion}_${hmac.slice(0, 32)}`;
}
