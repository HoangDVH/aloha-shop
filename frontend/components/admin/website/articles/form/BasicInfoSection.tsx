"use client";

import React from "react";
import { wbInput, wbSelect } from "../../ui";
import { slugifyVi, type FormState } from "../articleUtils";

export function BasicInfoSection({
  editing,
  patchEditing,
  slugManual,
  setSlugManual,
  titleLen,
  categories,
}: {
  editing: FormState;
  patchEditing: (next: FormState) => void;
  slugManual: boolean;
  setSlugManual: React.Dispatch<React.SetStateAction<boolean>>;
  titleLen: number;
  categories: string[];
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900">Thông tin cơ bản</h3>
      <div className="space-y-5">
        {/* Tiêu đề */}
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
            Tiêu đề <span className="text-red-500">*</span>
          </label>
          <input
            className={`${wbInput} h-11`}
            value={editing.title}
            maxLength={225}
            placeholder="Nhập tiêu đề"
            onChange={(e) => {
              const title = e.target.value.slice(0, 225);
              patchEditing({
                ...editing,
                title,
                slug: slugManual ? editing.slug : slugifyVi(title),
              });
            }}
          />
          <p className="mt-1 text-right text-[11px] text-slate-400">
            {titleLen}/225
          </p>
        </div>

        {/* Đường dẫn */}
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
            Đường dẫn (slug)
          </label>
          <input
            className={wbInput}
            value={editing.slug}
            placeholder="tu-dong-theo-tieu-de"
            onChange={(e) => {
              setSlugManual(true);
              patchEditing({ ...editing, slug: slugifyVi(e.target.value) });
            }}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            {editing.previousSlugs?.length
              ? `Link cũ vẫn vào được: ${editing.previousSlugs.slice(0, 3).join(", ")}`
              : "Đổi slug sau này: khách mở link cũ sẽ chuyển sang link mới"}
          </p>
        </div>

        {/* Danh mục */}
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
            Danh mục <span className="text-red-500">*</span>
          </label>
          <select
            className={`${wbSelect} h-11`}
            value={editing.category}
            onChange={(e) => patchEditing({ ...editing, category: e.target.value })}
          >
            <option value="">-- Chọn danh mục --</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className={`${wbInput} mt-2`}
            placeholder="Hoặc gõ danh mục mới…"
            value={
              categories.includes(editing.category) ? "" : editing.category
            }
            onChange={(e) => patchEditing({ ...editing, category: e.target.value })}
          />
        </div>
      </div>
    </section>
  );
}
