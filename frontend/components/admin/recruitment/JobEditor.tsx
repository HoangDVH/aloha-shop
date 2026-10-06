"use client";

import { useState } from "react";
import { ArrowLeft, Eye, Lock, Plus, Trash2 } from "lucide-react";
import { WbBtn, WbField, wbInput, wbSelect } from "@/components/admin/website/ui";
import { JobDetailView } from "@/components/recruitment/JobDetailView";
import { JobRichEditor } from "./JobRichEditor";
import {
  EDUCATION_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  LEVEL_LABELS,
  SALARY_MODE_LABELS,
  type JobLocation,
} from "@/lib/recruitment";
import { JOB_STATUS_LABELS, formToPreview, type JobFormState } from "./recruitmentAdminTypes";

const area = `${wbInput} h-auto min-h-[120px] py-2 leading-relaxed`;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h3 className="mb-4 text-[13px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function JobEditor({
  form,
  onChange,
  onClose,
  onSave,
  saving,
  dirty,
  suggestedLocations,
  error,
}: {
  form: JobFormState;
  onChange: (next: JobFormState) => void;
  onClose: () => void;
  onSave: (action: "save" | "open" | "close") => void;
  saving: boolean;
  dirty: boolean;
  suggestedLocations: JobLocation[];
  error: { field?: string; message: string } | null;
}) {
  const [preview, setPreview] = useState(false);
  const locked = form.published;
  const set = <K extends keyof JobFormState>(k: K, v: JobFormState[K]) => onChange({ ...form, [k]: v });
  const lockHint = locked ? "Đã đăng — muốn đổi: đóng tin rồi «Nhân bản»" : undefined;

  const addLocation = (l?: JobLocation) => {
    if (form.locations.length >= 5) return;
    if (l && form.locations.some((x) => x.city === l.city && x.address === l.address)) return;
    set("locations", [...form.locations, l ? { ...l } : { city: "", address: "" }]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <WbBtn variant="ghost" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" /> Danh sách
          </WbBtn>
          <span className="text-sm font-semibold text-slate-700">
            {form.id ? "Sửa tin" : "Tin mới"} · {JOB_STATUS_LABELS[form.status]}
            {dirty ? " · chưa lưu" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <WbBtn variant="secondary" onClick={() => setPreview((v) => !v)}>
            <Eye className="h-4 w-4" /> {preview ? "Sửa" : "Xem trước"}
          </WbBtn>
          <WbBtn variant="secondary" disabled={saving} onClick={() => onSave("save")}>
            {form.status === "draft" ? "Lưu nháp" : "Lưu"}
          </WbBtn>
          {form.status !== "open" ? (
            <WbBtn variant="primary" disabled={saving} onClick={() => onSave("open")}>
              Lưu & mở tin
            </WbBtn>
          ) : (
            <WbBtn variant="danger" disabled={saving} onClick={() => onSave("close")}>
              Đóng tin
            </WbBtn>
          )}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100" role="alert">
          {error.message}
        </p>
      ) : null}

      {preview ? (
        <div className="rounded-xl bg-[#F7F7F4] p-4 sm:p-6">
          <JobDetailView job={formToPreview(form)} />
        </div>
      ) : (
        <>
          <Group title="1. Thông tin việc">
            <WbField label="Tên công việc/vị trí *">
              <input className={wbInput} value={form.title} maxLength={150} onChange={(e) => set("title", e.target.value)} />
            </WbField>
            <WbField label="Đường dẫn (slug)" hint={locked ? "Không đổi sau khi đã đăng" : "Để trống: tạo từ tên vị trí"}>
              <input className={wbInput} value={form.slug} disabled={locked} onChange={(e) => set("slug", e.target.value)} />
            </WbField>
            <WbField label="Phòng ban">
              <input className={wbInput} value={form.department} maxLength={100} onChange={(e) => set("department", e.target.value)} />
            </WbField>
            <WbField label="Ngành nghề">
              <input className={wbInput} value={form.jobCategory} maxLength={100} onChange={(e) => set("jobCategory", e.target.value)} />
            </WbField>
            <WbField label="Cấp bậc">
              <select className={wbSelect} value={form.level} onChange={(e) => set("level", e.target.value as JobFormState["level"])}>
                <option value="">— Không hiển thị —</option>
                {Object.entries(LEVEL_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </WbField>
            <WbField label="Loại hình làm việc *" hint={lockHint}>
              <select className={wbSelect} value={form.employmentType} disabled={locked} onChange={(e) => set("employmentType", e.target.value as JobFormState["employmentType"])}>
                {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </WbField>
            <WbField label="Số lượng tuyển">
              <input className={wbInput} inputMode="numeric" value={form.vacancies} onChange={(e) => set("vacancies", e.target.value.replace(/\D/g, ""))} />
            </WbField>
            <div className="md:col-span-2">
              <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-gray-600">
                Nơi làm việc * (tối đa 5) {locked ? <Lock className="h-3 w-3" aria-label={lockHint} /> : null}
              </span>
              <div className="space-y-2">
                {form.locations.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={`${wbInput} max-w-[180px]`} placeholder="Tỉnh/thành" value={l.city} disabled={locked}
                      onChange={(e) => set("locations", form.locations.map((x, j) => (j === i ? { city: e.target.value, address: x.address } : x)))} />
                    <input className={wbInput} placeholder="Địa chỉ" value={l.address} disabled={locked}
                      onChange={(e) => set("locations", form.locations.map((x, j) => (j === i ? { city: x.city, address: e.target.value } : x)))} />
                    {!locked ? (
                      <WbBtn variant="ghost" title="Xóa" onClick={() => set("locations", form.locations.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </WbBtn>
                    ) : null}
                  </div>
                ))}
              </div>
              {!locked ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <WbBtn variant="ghost" onClick={() => addLocation()} disabled={form.locations.length >= 5}>
                    <Plus className="h-4 w-4" /> Thêm địa điểm
                  </WbBtn>
                  {suggestedLocations.map((l) => (
                    <WbBtn key={l.key} variant="ghost" onClick={() => addLocation(l)} disabled={form.locations.length >= 5}>
                      + {l.address ? `${l.address}, ${l.city}` : l.city}
                    </WbBtn>
                  ))}
                </div>
              ) : null}
            </div>
          </Group>

          <Group title="2. Điều kiện và thu nhập">
            <WbField label="Kinh nghiệm yêu cầu *" hint={lockHint || "Nhập theo tháng — 12 = 1 năm"}>
              <div className="flex gap-2">
                <select className={`${wbSelect} max-w-[160px]`} value={form.expMode} disabled={locked} onChange={(e) => set("expMode", e.target.value as "none" | "required")}>
                  <option value="none">Không yêu cầu</option>
                  <option value="required">Có yêu cầu</option>
                </select>
                {form.expMode === "required" ? (
                  <>
                    <input className={wbInput} inputMode="numeric" placeholder="Từ (tháng)" value={form.expMin} disabled={locked} onChange={(e) => set("expMin", e.target.value.replace(/\D/g, ""))} />
                    <input className={wbInput} inputMode="numeric" placeholder="Đến (tháng)" value={form.expMax} disabled={locked} onChange={(e) => set("expMax", e.target.value.replace(/\D/g, ""))} />
                  </>
                ) : null}
              </div>
            </WbField>
            <WbField label="Bằng cấp" hint={lockHint}>
              <select className={wbSelect} value={form.educationRequirement} disabled={locked} onChange={(e) => set("educationRequirement", e.target.value as JobFormState["educationRequirement"])}>
                <option value="">— Không hiển thị —</option>
                {Object.entries(EDUCATION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </WbField>
            <WbField label="Lương *" hint={lockHint || "VNĐ, chỉ nhập mức được phép công bố"}>
              <div className="flex flex-wrap gap-2">
                <select className={`${wbSelect} max-w-[140px]`} value={form.salaryMode} disabled={locked} onChange={(e) => set("salaryMode", e.target.value as JobFormState["salaryMode"])}>
                  {Object.entries(SALARY_MODE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                {form.salaryMode === "range" || form.salaryMode === "from" ? (
                  <input className={`${wbInput} max-w-[160px]`} inputMode="numeric" placeholder="Tối thiểu" value={form.salaryMin} disabled={locked} onChange={(e) => set("salaryMin", e.target.value.replace(/\D/g, ""))} />
                ) : null}
                {form.salaryMode === "range" || form.salaryMode === "up_to" ? (
                  <input className={`${wbInput} max-w-[160px]`} inputMode="numeric" placeholder="Tối đa" value={form.salaryMax} disabled={locked} onChange={(e) => set("salaryMax", e.target.value.replace(/\D/g, ""))} />
                ) : null}
                {form.salaryMode !== "negotiated" ? (
                  <select className={`${wbSelect} max-w-[120px]`} value={form.salaryPeriod} disabled={locked} onChange={(e) => set("salaryPeriod", e.target.value as JobFormState["salaryPeriod"])}>
                    <option value="month">/tháng</option>
                    <option value="hour">/giờ</option>
                  </select>
                ) : null}
              </div>
            </WbField>
            <WbField label="Thời gian/ca làm">
              <input className={wbInput} value={form.shiftDescription} maxLength={500} placeholder="VD: Ca 8h–17h, nghỉ Chủ nhật" onChange={(e) => set("shiftDescription", e.target.value)} />
            </WbField>
          </Group>

          <Group title="3. Nội dung">
            <div className="md:col-span-2">
              <WbField label="Mô tả công việc *" hint="Sử dụng thanh công cụ để in đậm, gạch đầu dòng danh sách hoặc tiêu đề phụ">
                <JobRichEditor
                  value={form.description}
                  onChange={(v) => set("description", v)}
                  placeholder="Mô tả chi tiết các nhiệm vụ, đầu việc chính của vị trí..."
                  minHeight="150px"
                  disabled={saving}
                />
              </WbField>
            </div>
            <div className="md:col-span-2">
              <WbField label="Yêu cầu công việc *" hint="Liệt kê kỹ năng, kinh nghiệm và thái độ làm việc cần thiết">
                <JobRichEditor
                  value={form.requirements}
                  onChange={(v) => set("requirements", v)}
                  placeholder="Yêu cầu kinh nghiệm, kỹ năng, tinh thần trách nhiệm..."
                  minHeight="130px"
                  disabled={saving}
                />
              </WbField>
            </div>
            <div className="md:col-span-2">
              <WbField label="Quyền lợi *" hint="Chỉ ghi quyền lợi có thật; hoa hồng/phụ cấp ghi rõ, không gộp vào lương cứng">
                <JobRichEditor
                  value={form.benefits}
                  onChange={(v) => set("benefits", v)}
                  placeholder="Lương thưởng, chế độ BHXH, phụ cấp ăn trưa, cơ hội thăng tiến..."
                  minHeight="130px"
                  disabled={saving}
                />
              </WbField>
            </div>
          </Group>

          <Group title="4. Đăng tin">
            <WbField label="Hạn nộp hồ sơ *" hint="Hết hạn vào cuối ngày (giờ Việt Nam)">
              <input type="date" className={wbInput} value={form.deadlineDate} onChange={(e) => set("deadlineDate", e.target.value)} />
            </WbField>
            <WbField label="Yêu cầu CV" hint={lockHint || "Nếu web chưa bật nhận CV, ứng viên phải mô tả kinh nghiệm thay thế"}>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input type="checkbox" checked={form.cvRequired} disabled={locked} onChange={(e) => set("cvRequired", e.target.checked)} />
                Bắt buộc đính kèm CV
              </label>
            </WbField>
          </Group>
        </>
      )}
    </div>
  );
}
