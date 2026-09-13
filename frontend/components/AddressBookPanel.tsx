"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
  type ShopAddress,
} from "@/lib/orders";
import { VN_PROVINCES, wardsForProvince } from "@/lib/vnLocations";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useShopLoadingWhile } from "@/lib/useShopLoadingWhile";

type Draft = {
  fullName: string;
  phone: string;
  province: string;
  ward: string;
  detail: string;
  isDefault: boolean;
};

const emptyDraft = (name = "", phone = ""): Draft => ({
  fullName: name,
  phone,
  province: "",
  ward: "",
  detail: "",
  isDefault: false,
});

export function AddressBookPanel() {
  const { user } = useShopAuth();
  const [list, setList] = useState<ShopAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setList(await listAddresses());
    } catch (e: any) {
      setError(e?.message || "Không tải được sổ địa chỉ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const wards = wardsForProvince(draft.province);

  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setDraft(emptyDraft(user?.fullName || "", user?.phone || ""));
  };

  const startEdit = (a: ShopAddress) => {
    setAdding(false);
    setEditingId(a.id);
    setDraft({
      fullName: a.fullName,
      phone: a.phone,
      province: a.province,
      ward: a.ward,
      detail: a.detail,
      isDefault: a.isDefault,
    });
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (!draft.fullName.trim() || !draft.phone.trim() || !draft.province || !draft.ward || !draft.detail.trim()) {
        setError("Điền đủ thông tin địa chỉ");
        return;
      }
      if (editingId) {
        const res = await updateAddress(editingId, {
          fullName: draft.fullName.trim(),
          phone: draft.phone.trim(),
          province: draft.province,
          ward: draft.ward,
          detail: draft.detail.trim(),
          isDefault: draft.isDefault,
        });
        setList(res.addresses);
      } else {
        const res = await createAddress({
          fullName: draft.fullName.trim(),
          phone: draft.phone.trim(),
          province: draft.province,
          ward: draft.ward,
          detail: draft.detail.trim(),
          isDefault: draft.isDefault || list.length === 0,
        });
        setList(res.addresses);
      }
      setAdding(false);
      setEditingId(null);
    } catch (e: any) {
      setError(e?.message || "Không lưu được");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Xóa địa chỉ này?")) return;
    setBusy(true);
    try {
      const res = await deleteAddress(id);
      setList(res.addresses);
    } catch (e: any) {
      setError(e?.message || "Không xóa được");
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (id: string) => {
    setBusy(true);
    try {
      const res = await updateAddress(id, { isDefault: true });
      setList(res.addresses);
    } catch (e: any) {
      setError(e?.message || "Không đặt mặc định được");
    } finally {
      setBusy(false);
    }
  };

  useShopLoadingWhile(loading || busy);

  if (loading) {
    return null;
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#E5DFD2] sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#1a2e1a]">
          <MapPin size={20} className="text-[var(--aloha-green)]" />
          Sổ địa chỉ
        </h2>
        {!adding && !editingId ? (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--aloha-green)] px-3 py-2 text-sm font-bold text-white"
          >
            <Plus size={16} /> Thêm địa chỉ
          </button>
        ) : null}
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {!list.length && !adding ? (
        <p className="text-sm text-slate-500">
          Chưa có địa chỉ. Thêm một lần — lần sau đặt hàng sẽ tự điền.
        </p>
      ) : null}

      <ul className="space-y-3">
        {list.map((a) =>
          editingId === a.id ? null : (
            <li
              key={a.id}
              className="rounded-xl border border-[#E5DFD2] bg-[#FBF9F4] px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[#1a2e1a]">
                    {a.fullName} · {a.phone}
                    {a.isDefault ? (
                      <span className="ml-2 rounded bg-[var(--aloha-green)] px-1.5 py-0.5 text-[10px] text-white">
                        Mặc định
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {a.detail}, {a.ward}, {a.province}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!a.isDefault ? (
                    <button
                      type="button"
                      title="Đặt mặc định"
                      disabled={busy}
                      onClick={() => void setDefault(a.id)}
                      className="rounded-lg p-2 text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
                    >
                      <Star size={16} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    title="Sửa"
                    onClick={() => startEdit(a)}
                    className="rounded-lg p-2 text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    title="Xóa"
                    disabled={busy}
                    onClick={() => void remove(a.id)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </li>
          )
        )}
      </ul>

      {adding || editingId ? (
        <div className="mt-4 space-y-3 rounded-xl border border-[#D5E3D0] bg-[#F7FBF5] p-4">
          <p className="text-sm font-bold text-[#1a2e1a]">
            {editingId ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="auth-field"
              placeholder="Họ tên *"
              value={draft.fullName}
              onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
            />
            <input
              className="auth-field"
              placeholder="SĐT *"
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            />
            <select
              className="auth-field"
              value={draft.province}
              onChange={(e) =>
                setDraft((d) => ({ ...d, province: e.target.value, ward: "" }))
              }
            >
              <option value="">Tỉnh/Thành *</option>
              {VN_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {wards.length ? (
              <select
                className="auth-field"
                value={draft.ward}
                onChange={(e) => setDraft((d) => ({ ...d, ward: e.target.value }))}
              >
                <option value="">Phường/Xã *</option>
                {wards.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="auth-field"
                placeholder="Phường/Xã *"
                value={draft.ward}
                onChange={(e) => setDraft((d) => ({ ...d, ward: e.target.value }))}
              />
            )}
          </div>
          <input
            className="auth-field"
            placeholder="Địa chỉ chi tiết *"
            value={draft.detail}
            onChange={(e) => setDraft((d) => ({ ...d, detail: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="accent-[#3D6B3A]"
              checked={draft.isDefault}
              onChange={(e) => setDraft((d) => ({ ...d, isDefault: e.target.checked }))}
            />
            Đặt làm địa chỉ mặc định
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-lg bg-[var(--aloha-green)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setEditingId(null);
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Hủy
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
