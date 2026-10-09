export const GIFT_FILTER_OPTIONS = [
  { value: "nguoi-thuong", label: "Người thương" },
  { value: "gia-dinh", label: "Gia đình & Mẹ" },
  { value: "khai-truong", label: "Khai trương & Thăng chức" },
  { value: "ban-lam-viec", label: "Bàn làm việc & Đồng nghiệp" },
] as const;
export function giftFilterLabel(value: string) {
  return GIFT_FILTER_OPTIONS.find(option => option.value === value)?.label || value;
}
