"use client";

import { useEffect, useState } from "react";
import { Drawer } from "antd";
import { Download, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { websiteApi } from "@/components/admin/website/api";
import { WbBadge, WbBtn, WbField, wbInput, wbSelect } from "@/components/admin/website/ui";
import {
  APPLICATION_SOURCE_LABELS,
  APPLICATION_STATUS_LABELS,
  CV_FORMAT_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  formatLocation,
  formatVnDate,
  formatVnDateTime,
  type ApplicationStatus,
} from "@/lib/recruitment";
import type { AdminApplicationDetail, AdminJob } from "./recruitmentAdminTypes";

const API = "/api/shop/admin/recruitment/applications";
const area = `${wbInput} h-auto min-h-[72px] py-2`;

const ACTION_LABELS: Record<string, string> = {
  created: "Nộp hồ sơ",
  status_changed: "Đổi trạng thái",
  assigned: "Giao người phụ trách",
  unassigned: "Bỏ người phụ trách",
  appointment_set: "Đặt lịch hẹn",
  appointment_changed: "Đổi lịch hẹn",
  appointment_cleared: "Hủy lịch hẹn",
  linked_job: "Gắn vào tin",
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-slate-100 pt-4">
      <h3 className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

export function ApplicationDrawer({
  id,
  jobs,
  onClose,
  onChanged,
}: {
  id: string | null;
  jobs: AdminJob[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [item, setItem] = useState<AdminApplicationDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus | "">("");
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState("");
  const [appt, setAppt] = useState({ startsAt: "", mode: "onsite", locationOrLink: "", note: "" });
  const [note, setNote] = useState("");
  const [linkJobId, setLinkJobId] = useState("");

  const hydrate = (d: AdminApplicationDetail) => {
    setItem(d);
    setNextStatus("");
    setReason("");
    setAssignee(d.assignedTo || "");
    setAppt({
      startsAt: toLocalInput(d.appointment?.startsAt),
      mode: d.appointment?.mode || "onsite",
      locationOrLink: d.appointment?.locationOrLink || "",
      note: d.appointment?.note || "",
    });
    setLinkJobId("");
  };

  useEffect(() => {
    if (!id) {
      setItem(null);
      return;
    }
    websiteApi<{ item: AdminApplicationDetail }>(`${API}/${id}`)
      .then((r) => hydrate(r.item))
      .catch((e) => toast.error(e?.message || "Không tải được hồ sơ"));
  }, [id]);

  const patch = async (body: Record<string, unknown>, okMsg: string) => {
    if (!item) return;
    setBusy(true);
    try {
      const r = await websiteApi<{ item: AdminApplicationDetail; warning?: string }>(`${API}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ expectedVersion: item.version, ...body }),
      });
      hydrate(r.item);
      toast.success(okMsg);
      if (r.warning) toast.warning(r.warning);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Cập nhật thất bại");
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!item || !note.trim()) return;
    setBusy(true);
    try {
      const r = await websiteApi<{ item: AdminApplicationDetail }>(`${API}/${item.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ text: note.trim() }),
      });
      setItem(r.item);
      setNote("");
    } catch (e: any) {
      toast.error(e?.message || "Không thêm được ghi chú");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    if (!window.confirm(`Xóa vĩnh viễn hồ sơ ${item.publicCode} và CV? Không hoàn tác được.`)) return;
    setBusy(true);
    try {
      await websiteApi(`${API}/${item.id}`, { method: "DELETE" });
      toast.success("Đã xóa hồ sơ");
      onChanged();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Xóa thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={Boolean(id)} onClose={onClose} size={560} title={item ? `${item.contact.fullName} · ${item.publicCode}` : "Hồ sơ"} destroyOnHidden>
      {!item ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="space-y-4 text-sm text-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            <WbBadge tone="info">{APPLICATION_STATUS_LABELS[item.status]}</WbBadge>
            <WbBadge>{item.submissionType === "general_interest" ? "Liên hệ tuyển dụng" : "Ứng tuyển tin"}</WbBadge>
            {item.possibleDuplicate ? <WbBadge tone="warn">Nghi trùng email</WbBadge> : null}
            {item.hasAccount ? <WbBadge tone="success">Có tài khoản shop</WbBadge> : <WbBadge>Khách</WbBadge>}
          </div>

          {item.account ? (
            <p className="flex items-start gap-2 rounded-lg bg-[#E8F5E9] px-3 py-2 text-[13px]">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#0F9D58]" />
              <span>
                Nộp khi đang đăng nhập tài khoản <b>{item.account.fullName || item.account.email}</b> ({item.account.email})
                {item.account.active ? "" : " — tài khoản đã khóa"}. Thông tin liên hệ bên dưới là bản ứng viên nhập lúc nộp.
              </span>
            </p>
          ) : item.hasAccount ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-500">Tài khoản shop liên kết đã bị xóa.</p>
          ) : null}

          <div className="space-y-1">
            <p><b>Vị trí:</b> {item.jobSummary?.title || item.interestedPosition}</p>
            <p><b>Email:</b> <a className="text-[#0C8048] underline" href={`mailto:${item.contact.email}`}>{item.contact.email}</a></p>
            <p><b>Điện thoại:</b> <a className="text-[#0C8048] underline" href={`tel:${item.contact.phone}`}>{item.contact.phone}</a></p>
            <p><b>Kinh nghiệm:</b> {EXPERIENCE_LEVEL_LABELS[item.experienceLevel]}</p>
            <p>
              <b>Nơi làm mong muốn:</b>{" "}
              {item.locationPreference.mode === "any" ? "Tất cả" : (item.locationPreference.locations || []).map(formatLocation).join("; ")}
            </p>
            <p><b>Ngày nộp:</b> {formatVnDateTime(item.createdAt)}</p>
            <p><b>Nguồn nộp:</b> {item.source ? APPLICATION_SOURCE_LABELS[item.source] : "Không rõ"}</p>
            {item.experienceSummary ? <p className="whitespace-pre-line rounded-lg bg-slate-50 p-2">{item.experienceSummary}</p> : null}
            {item.cv ? (
              <div className="space-y-2 pt-1">
                <WbBtn variant="secondary" href={`${API}/${item.id}/cv`}>
                  <Download className="h-4 w-4" /> Tải CV {CV_FORMAT_LABELS[item.cv.format]} ({Math.ceil(item.cv.sizeBytes / 1024)} KB)
                </WbBtn>
                <p className="text-[12px] text-slate-500">{item.cv.originalName}</p>
                {item.cv.format !== "pdf" ? (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ring-1 ring-amber-200">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      File Word chưa được quét mã độc. Mở ở chế độ xem được bảo vệ (Protected View), không bấm
                      “Enable Editing / Enable Content”, không bật macro.
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <Block title="Trạng thái">
            <div className="flex gap-2">
              <select className={wbSelect} value={nextStatus} onChange={(e) => setNextStatus(e.target.value as ApplicationStatus)}>
                <option value="">— Chuyển sang —</option>
                {Object.entries(APPLICATION_STATUS_LABELS)
                  .filter(([v]) => v !== item.status)
                  .map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
              </select>
              <WbBtn variant="primary" disabled={!nextStatus || busy} onClick={() => void patch({ status: nextStatus, reason }, "Đã đổi trạng thái")}>
                Cập nhật
              </WbBtn>
            </div>
            <textarea className={area} placeholder="Lý do (bắt buộc khi chuyển lùi hoặc mở lại; nên ghi khi từ chối)" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Block>

          <Block title="Người phụ trách">
            <div className="flex gap-2">
              <input className={wbInput} placeholder="Tên đăng nhập người phụ trách" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
              <WbBtn variant="secondary" disabled={busy || assignee === (item.assignedTo || "")} onClick={() => void patch({ assignedTo: assignee }, "Đã cập nhật người phụ trách")}>
                Lưu
              </WbBtn>
            </div>
          </Block>

          <Block title="Lịch hẹn">
            <div className="grid grid-cols-2 gap-2">
              <WbField label="Thời gian">
                <input type="datetime-local" className={wbInput} value={appt.startsAt} onChange={(e) => setAppt({ ...appt, startsAt: e.target.value })} />
              </WbField>
              <WbField label="Hình thức">
                <select className={wbSelect} value={appt.mode} onChange={(e) => setAppt({ ...appt, mode: e.target.value })}>
                  <option value="onsite">Trực tiếp</option>
                  <option value="phone">Điện thoại</option>
                  <option value="online">Online</option>
                </select>
              </WbField>
            </div>
            <input className={wbInput} placeholder="Địa điểm hoặc link" value={appt.locationOrLink} onChange={(e) => setAppt({ ...appt, locationOrLink: e.target.value })} />
            <input className={wbInput} placeholder="Ghi chú lịch hẹn" value={appt.note} onChange={(e) => setAppt({ ...appt, note: e.target.value })} />
            <div className="flex gap-2">
              <WbBtn
                variant="secondary"
                disabled={busy || !appt.startsAt}
                onClick={() =>
                  void patch({ appointment: { ...appt, startsAt: new Date(appt.startsAt).toISOString() } }, "Đã lưu lịch hẹn")
                }
              >
                Lưu lịch hẹn
              </WbBtn>
              {item.appointment ? (
                <WbBtn variant="ghost" disabled={busy} onClick={() => void patch({ appointment: null }, "Đã hủy lịch hẹn")}>Hủy lịch</WbBtn>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-400">Hệ thống không tự gửi lịch — người phụ trách liên hệ ứng viên xác nhận.</p>
          </Block>

          {!item.jobId ? (
            <Block title="Chuyển sang quy trình của một tin">
              <select className={wbSelect} value={linkJobId} onChange={(e) => setLinkJobId(e.target.value)}>
                <option value="">— Chọn tin —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
              <WbBtn variant="secondary" disabled={busy || !linkJobId || !reason.trim()} onClick={() => void patch({ linkJobId, reason }, "Đã gắn hồ sơ vào tin")}>
                Gắn vào tin (dùng ô lý do phía trên)
              </WbBtn>
              <p className="text-[11px] text-slate-400">Chỉ gắn sau khi ứng viên đã xác nhận đồng ý ứng tuyển vị trí đó.</p>
            </Block>
          ) : null}

          <Block title={`Ghi chú (${item.notes.length}/50)`}>
            <ul className="space-y-2">
              {item.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-slate-50 p-2">
                  <p className="whitespace-pre-line">{n.text}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{n.authorId} · {formatVnDateTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
            <textarea className={area} maxLength={2000} placeholder="Thêm ghi chú nội bộ…" value={note} onChange={(e) => setNote(e.target.value)} />
            <WbBtn variant="secondary" disabled={busy || !note.trim()} onClick={() => void addNote()}>Thêm ghi chú</WbBtn>
          </Block>

          <Block title="Lịch sử">
            <ul className="space-y-1 text-[12px]">
              {[...item.history].reverse().map((h) => (
                <li key={h.id}>
                  <span className="text-slate-400">{formatVnDateTime(h.at)}</span> · <b>{h.actorId}</b> · {ACTION_LABELS[h.action] || h.action}
                  {h.toStatus ? ` → ${APPLICATION_STATUS_LABELS[h.toStatus]}` : ""}
                  {h.reason ? ` — ${h.reason}` : ""}
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Dữ liệu">
            <p className="text-[12px]">
              Đồng ý: {item.consent.purpose === "specific_job" ? "ứng tuyển tin" : "liên hệ tuyển dụng"} · phiên bản {item.consent.noticeVersion} ·{" "}
              {formatVnDateTime(item.consent.acceptedAt)}
            </p>
            <p className="text-[12px]">Tự xóa sau: {formatVnDate(item.retentionUntil)}</p>
            <p className="text-[12px]">
              Email xác nhận: {item.confirmation ? `${item.confirmation.status}${item.confirmation.lastErrorCode ? ` (${item.confirmation.lastErrorCode})` : ""}` : "không gửi (chưa bật mail)"}
            </p>
            <WbBtn variant="danger" disabled={busy} onClick={() => void remove()}>
              <Trash2 className="h-4 w-4" /> Xóa hồ sơ và CV
            </WbBtn>
          </Block>
        </div>
      )}
    </Drawer>
  );
}
