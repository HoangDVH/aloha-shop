"use client";

import React from "react";
import { Loader2, X } from "lucide-react";
import { WbBtn, wbInput } from "../../ui";
import { fromLocalInput, toLocalInput, type FormState } from "../articleUtils";
import { ProductPicker } from "../../shared/ProductPicker";

export function ProductsPublishSection({
  editing,
  patchEditing,
  addProduct,
  closeEdit,
  save,
  saving,
  mediaBusy,
}: {
  editing: FormState;
  patchEditing: (next: FormState) => void;
  addProduct: (ma: string) => void;
  closeEdit: () => void;
  save: () => Promise<void> | void;
  saving: boolean;
  mediaBusy: boolean;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="mb-1 text-[15px] font-bold text-slate-900">Sản phẩm &amp; xuất bản</h3>
      <p className="mb-4 text-[12px] text-slate-500">
        Tối đa 12 mã — hiện lưới card giống trang chủ dưới nội dung trên shop
      </p>
      <ProductPicker className="mb-6" onPick={(p) => addProduct(p.ma)} />
      {editing.productMas.length ? (
        <ul className="mb-6 flex flex-wrap gap-1.5">
          {editing.productMas.map((ma) => (
            <li
              key={ma}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-700"
            >
              {ma}
              <button
                type="button"
                className="text-slate-400 hover:text-red-500"
                onClick={() =>
                  patchEditing({
                    ...editing,
                    productMas: editing.productMas.filter((x) => x !== ma),
                  })
                }
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
            Ngày xuất bản
          </label>
          <input
            type="datetime-local"
            className={wbInput}
            value={toLocalInput(editing.publishedAt)}
            onChange={(e) =>
              patchEditing({
                ...editing,
                publishedAt: fromLocalInput(e.target.value),
              })
            }
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-[13px] font-medium text-gray-700">
            <input
              type="checkbox"
              checked={editing.visible}
              onChange={(e) =>
                patchEditing({ ...editing, visible: e.target.checked })
              }
            />
            Hiện trên web
          </label>
        </div>
      </div>

      <div className="mt-6 hidden items-center justify-end gap-2 border-t border-gray-100 pt-4 sm:flex">
        <WbBtn variant="ghost" onClick={closeEdit}>
          Hủy
        </WbBtn>
        <WbBtn variant="primary" disabled={saving || mediaBusy} onClick={() => void save()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {editing.id ? "Lưu bài" : "Đăng bài"}
        </WbBtn>
      </div>
    </section>
  );
}
