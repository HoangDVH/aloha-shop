"use client";

import { useEffect, useState } from "react";
import {
  EMPTY_CHECKOUT_ADDRESS,
  fetchGhnDistricts,
  fetchGhnProvinces,
  fetchGhnWards,
  type CheckoutAddressValue,
  type GhnDistrict,
  type GhnProvince,
  type GhnWard,
} from "@/lib/ghnLocations";
import { VN_PROVINCES, wardsForProvince } from "@/lib/vnLocations";
import { useShopLoadingWhile } from "@/lib/useShopLoadingWhile";

export type AddressDraft = CheckoutAddressValue & {
  fullName: string;
  phone: string;
  detail: string;
};

type Props = {
  value: AddressDraft;
  onChange: (patch: Partial<AddressDraft>) => void;
};

export function GhnAddressFields({ value, onChange }: Props) {
  const [ghnOk, setGhnOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [provinces, setProvinces] = useState<GhnProvince[]>([]);
  const [districts, setDistricts] = useState<GhnDistrict[]>([]);
  const [wards, setWards] = useState<GhnWard[]>([]);

  useEffect(() => {
    let alive = true;
    void fetchGhnProvinces()
      .then((r) => {
        if (!alive) return;
        if (r.ok && r.items?.length) {
          setGhnOk(true);
          setProvinces(r.items);
        }
      })
      .catch(() => {
        if (alive) setGhnOk(false);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useShopLoadingWhile(loading);

  useEffect(() => {
    if (!ghnOk || !value.ghnProvinceId) {
      setDistricts([]);
      return;
    }
    let alive = true;
    void fetchGhnDistricts(value.ghnProvinceId)
      .then((r) => {
        if (alive) setDistricts(r.items || []);
      })
      .catch(() => {
        if (alive) setDistricts([]);
      });
    return () => {
      alive = false;
    };
  }, [ghnOk, value.ghnProvinceId]);

  useEffect(() => {
    if (!ghnOk || !value.ghnDistrictId) {
      setWards([]);
      return;
    }
    let alive = true;
    void fetchGhnWards(value.ghnDistrictId)
      .then((r) => {
        if (alive) setWards(r.items || []);
      })
      .catch(() => {
        if (alive) setWards([]);
      });
    return () => {
      alive = false;
    };
  }, [ghnOk, value.ghnDistrictId]);

  const staticWards = wardsForProvince(value.province);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
            Tên khách hàng <span className="text-red-500">*</span>
          </span>
          <input
            className="auth-field"
            value={value.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            placeholder="Họ và tên"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
            Số điện thoại <span className="text-red-500">*</span>
          </span>
          <input
            className="auth-field"
            value={value.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="09..."
            inputMode="tel"
          />
        </label>
      </div>

      {loading ? null : ghnOk ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Tỉnh/Thành <span className="text-red-500">*</span>
            </span>
            <select
              className="auth-field"
              value={value.ghnProvinceId || ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                const p = provinces.find((x) => x.id === id);
                onChange({
                  ...EMPTY_CHECKOUT_ADDRESS,
                  ghnProvinceId: id,
                  province: p?.name || "",
                });
              }}
            >
              <option value="">Chọn tỉnh/thành</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Quận/Huyện <span className="text-red-500">*</span>
            </span>
            <select
              className="auth-field"
              value={value.ghnDistrictId || ""}
              disabled={!value.ghnProvinceId}
              onChange={(e) => {
                const id = Number(e.target.value);
                const d = districts.find((x) => x.id === id);
                onChange({
                  district: d?.name || "",
                  ward: "",
                  ghnDistrictId: id,
                  ghnWardCode: "",
                });
              }}
            >
              <option value="">Chọn quận/huyện</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Phường/Xã <span className="text-red-500">*</span>
            </span>
            <select
              className="auth-field"
              value={value.ghnWardCode || ""}
              disabled={!value.ghnDistrictId}
              onChange={(e) => {
                const code = e.target.value;
                const w = wards.find((x) => x.code === code);
                onChange({ ward: w?.name || "", ghnWardCode: code });
              }}
            >
              <option value="">Chọn phường/xã</option>
              {wards.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Tỉnh/Thành phố <span className="text-red-500">*</span>
            </span>
            <select
              className="auth-field"
              value={value.province}
              onChange={(e) =>
                onChange({
                  ...EMPTY_CHECKOUT_ADDRESS,
                  province: e.target.value,
                })
              }
            >
              <option value="">Chọn tỉnh/thành</option>
              {VN_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Phường/Xã <span className="text-red-500">*</span>
            </span>
            {staticWards.length ? (
              <select
                className="auth-field"
                value={value.ward}
                onChange={(e) => onChange({ ward: e.target.value })}
              >
                <option value="">Chọn phường/xã</option>
                {staticWards.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="auth-field"
                value={value.ward}
                onChange={(e) => onChange({ ward: e.target.value })}
                placeholder="Nhập phường/xã"
              />
            )}
          </label>
          <p className="sm:col-span-2 text-xs text-amber-700">
            Chưa có GHN_TOKEN — dùng danh mục tĩnh. Thêm token vào .env để dropdown chuẩn GHN.
          </p>
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-600">
          Địa chỉ nhận hàng <span className="text-red-500">*</span>
        </span>
        <input
          className="auth-field"
          value={value.detail}
          onChange={(e) => onChange({ detail: e.target.value })}
          placeholder="Số nhà, tên đường..."
        />
      </label>
    </div>
  );
}
