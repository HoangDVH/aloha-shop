/**
 * Bảng quy đổi & nhận diện sáp nhập đơn vị hành chính.
 * Hỗ trợ hiển thị cảnh báo gợi ý đổi địa chỉ cũ sang địa chỉ mới sau các đợt sáp nhập.
 */

export interface AddressMergerSuggest {
  province: string;
  district?: string;
  ward?: string;
  displayText: string;
}

export interface AddressMergerRule {
  id: string;
  effectiveDate: string; // VD: "01/07/2025"
  match: {
    province: string[]; // từ khóa chuẩn hóa không dấu, VD: ["binh duong"]
    district?: string[]; // VD: ["thuan an"]
    ward?: string[]; // VD: ["lai thieu"]
  };
  suggest: AddressMergerSuggest;
}

export function normalizeAddressString(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const ADDRESS_MERGER_RULES: AddressMergerRule[] = [
  {
    id: "hcm-quan-2-thu-duc",
    effectiveDate: "01/01/2021",
    match: {
      province: ["ho chi minh", "hcm"],
      district: ["quan 2", "q 2", "q2"],
    },
    suggest: {
      province: "Thành phố Hồ Chí Minh",
      district: "Thành Phố Thủ Đức",
      displayText: "Thành Phố Thủ Đức - Thành phố Hồ Chí Minh",
    },
  },
  {
    id: "hcm-quan-9-thu-duc",
    effectiveDate: "01/01/2021",
    match: {
      province: ["ho chi minh", "hcm"],
      district: ["quan 9", "q 9", "q9"],
    },
    suggest: {
      province: "Thành phố Hồ Chí Minh",
      district: "Thành Phố Thủ Đức",
      displayText: "Thành Phố Thủ Đức - Thành phố Hồ Chí Minh",
    },
  },
  {
    id: "hcm-quan-thu-duc",
    effectiveDate: "01/01/2021",
    match: {
      province: ["ho chi minh", "hcm"],
      district: ["quan thu duc"],
    },
    suggest: {
      province: "Thành phố Hồ Chí Minh",
      district: "Thành Phố Thủ Đức",
      displayText: "Thành Phố Thủ Đức - Thành phố Hồ Chí Minh",
    },
  },
];

/**
 * Tìm quy tắc sáp nhập phù hợp dựa trên tỉnh, huyện, xã đã nhập / chọn.
 */
export function findAddressMergerSuggestion(params: {
  province?: string;
  district?: string;
  ward?: string;
  detail?: string;
}): AddressMergerRule | null {
  const normProvince = normalizeAddressString(params.province || "");
  const normDistrict = normalizeAddressString(params.district || "");
  const normWard = normalizeAddressString(params.ward || "");
  const normDetail = normalizeAddressString(params.detail || "");

  // Hợp nhất chuỗi để hỗ trợ trường hợp Khu vực gồm cả "Tỉnh - Huyện"
  const combinedRegion = `${normProvince} ${normDistrict}`.trim();

  for (const rule of ADDRESS_MERGER_RULES) {
    // 1. Kiểm tra tỉnh
    const provinceMatch = rule.match.province.some(
      (kw) => normProvince.includes(kw) || combinedRegion.includes(kw)
    );
    if (!provinceMatch) continue;

    // 2. Kiểm tra huyện (nếu có)
    if (rule.match.district && rule.match.district.length > 0) {
      const districtMatch = rule.match.district.some(
        (kw) =>
          normDistrict.includes(kw) ||
          combinedRegion.includes(kw) ||
          normWard.includes(kw) ||
          normDetail.includes(kw)
      );
      if (!districtMatch) continue;
    }

    // 3. Kiểm tra xã (nếu có)
    if (rule.match.ward && rule.match.ward.length > 0) {
      const wardMatch = rule.match.ward.some(
        (kw) => normWard.includes(kw) || normDetail.includes(kw)
      );
      if (!wardMatch) continue;
    }

    // Đảm bảo địa chỉ hiện tại chưa phải là địa chỉ mới (tránh lặp gợi ý)
    const normSuggestProvince = normalizeAddressString(rule.suggest.province);
    if (normProvince.includes(normSuggestProvince)) {
      if (!rule.suggest.district) continue;
      const normSuggestDistrict = normalizeAddressString(rule.suggest.district);
      if (normDistrict.includes(normSuggestDistrict)) continue;
    }

    return rule;
  }

  return null;
}
