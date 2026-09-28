"use client";

import React from "react";
import { Loader2, X } from "lucide-react";
import { WbBtn, wbInput } from "../../ui";
import {
  fromLocalInput,
  toLocalInput,
  type FormState,
  type ProductSuggest,
} from "../articleUtils";

export function ProductsPublishSection({
  editing,
  patchEditing,
  prodQ,
  setProdQ,
  prodSuggest,
  addProduct,
  closeEdit,
  save,
  saving,
  mediaBusy,
}: {
  editing: FormState;
  patchEditing: (next: FormState) => void;
  prodQ: string;
  setProdQ: React.Dispatch<React.SetStateAction<string>>;
  prodSuggest: ProductSuggest[];
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
      <div className="relative mb-6">
        <input
          className={wbInput}
          value={prodQ}
          onChange={(e) => setProdQ(e.target.value)}
          placeholder="Gõ mã hoặc tên SP…"
        />
        {prodSuggest.length ? (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {prodSuggest.map((p) => (
              <li key={p.ma}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50"
                  onClick={() => addProduct(p.ma)}
                >
                  <span className="font-semibold text-[#0F9D58]">{p.ma}</span>
                  <span className="truncate text-gray-600">{p.ten}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
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
