"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, message } from "antd";
import {
  campaignAdminApi,
  CampaignAdminError,
  type CampaignContentAdmin,
  type CampaignDocAdmin,
  type FieldError,
} from "@/lib/campaign/campaignAdminApi";
import { clearLocalBackup, readLocalBackup, saveLocalBackup } from "./wizardModel";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
const AUTOSAVE_MS = 1500;

function explain(e: CampaignAdminError): string {
  if (e.status === 401) return "Phiên đăng nhập hết hạn. Bản đang sửa vẫn giữ trên máy — đăng nhập lại rồi bấm Lưu.";
  if (e.code === "revision_conflict") return "Người khác vừa sửa chiến dịch này. Tải lại trang để lấy bản mới.";
  return e.message;
}

export function useCampaignDraft(id: string) {
  const [doc, setDoc] = useState<CampaignDocAdmin | null>(null);
  const [content, setContent] = useState<CampaignContentAdmin | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [state, setState] = useState<SaveState>("idle");
  const rev = useRef(0);
  const latest = useRef<CampaignContentAdmin | null>(null);
  const dirty = useRef(false);
  const inflight = useRef<Promise<number | null> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    void campaignAdminApi.get(id).then(({ item }) => {
      if (!alive) return;
      rev.current = item.revision;
      setDoc(item);
      latest.current = item.draft;
      setContent(item.draft);
      const backup = readLocalBackup(id);
      if (!backup || JSON.stringify(backup.content) === JSON.stringify(item.draft)) return clearLocalBackup(id);
      Modal.confirm({
        title: "Có bản đang sửa dở chưa lưu",
        content: "Lần trước bản sửa chưa lưu được lên máy chủ (mất mạng / hết phiên). Khôi phục bản đó?",
        okText: "Khôi phục",
        cancelText: "Bỏ bản đó",
        onOk: () => {
          latest.current = backup.content;
          dirty.current = true;
          setContent(backup.content);
          setState("dirty");
        },
        onCancel: () => clearLocalBackup(id),
      });
    }).catch((e) => message.error(e?.message || "Không tải được chiến dịch"));
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id]);

  const saveOnce = useCallback(async (): Promise<number | null> => {
    if (!dirty.current || !latest.current) return rev.current;
    const sending = latest.current;
    setState("saving");
    try {
      const { item } = await campaignAdminApi.saveDraft(id, sending, rev.current);
      rev.current = item.revision;
      setDoc(item);
      setErrors([]);
      if (latest.current === sending) {
        dirty.current = false;
        clearLocalBackup(id);
      }
      setState(dirty.current ? "dirty" : "saved");
      return rev.current;
    } catch (e) {
      const err = e as CampaignAdminError;
      setErrors(err.fields || []);
      setState("error");
      if (!err.fields?.length) message.error(explain(err));
      return null;
    }
  }, [id]);

  /** Chờ lượt lưu đang chạy rồi lưu tiếp phần mới sửa; trả revision mới nhất. */
  const flush = useCallback(async (): Promise<number | null> => {
    if (timer.current) clearTimeout(timer.current);
    while (inflight.current) await inflight.current;
    if (!dirty.current) return rev.current;
    inflight.current = saveOnce();
    try {
      return await inflight.current;
    } finally {
      inflight.current = null;
    }
  }, [saveOnce]);

  const update = useCallback(
    (fn: (c: CampaignContentAdmin) => CampaignContentAdmin) => {
      if (!latest.current) return;
      const next = fn(latest.current);
      latest.current = next;
      dirty.current = true;
      setContent(next);
      setState("dirty");
      saveLocalBackup(id, next, rev.current);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [id, flush]
  );

  const replaceDoc = useCallback((item: CampaignDocAdmin) => {
    rev.current = item.revision;
    latest.current = item.draft;
    dirty.current = false;
    setDoc(item);
    setContent(item.draft);
    setState("saved");
  }, []);

  return { doc, content, errors, state, update, flush, replaceDoc };
}
