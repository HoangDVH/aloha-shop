"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Spin, Steps } from "antd";
import { ArrowLeft, Check, CloudOff, Loader2 } from "lucide-react";
import { campaignAdminApi, rowGifts, type CampaignDocAdmin, type ProductFacts } from "@/lib/campaign/campaignAdminApi";
import { STEPS, stepOfPath } from "./wizardModel";
import { useCampaignDraft, type SaveState } from "./useCampaignDraft";
import { WhenStep } from "./steps/WhenStep";
import { ProductsStep } from "./steps/ProductsStep";
import { VouchersStep } from "./steps/VouchersStep";
import { DisplayStep } from "./steps/DisplayStep";
import { ReviewStep } from "./ReviewStep";

type Props = {
  id: string;
  canManage: boolean;
  onBack: () => void;
  onPublished: (doc: CampaignDocAdmin) => void;
  initialStep?: number;
};

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <Loader2 size={13} className="animate-spin" /> Đang lưu…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Check size={13} /> Đã lưu nháp
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
        <CloudOff size={13} /> Chưa lưu được — xem ô đỏ
      </span>
    );
  }
  if (state === "dirty") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        Có thay đổi chưa lưu
      </span>
    );
  }
  return null;
}

function useFacts(mas: string[]) {
  const [facts, setFacts] = useState<Record<string, ProductFacts>>({});
  const asked = useRef(new Set<string>());
  const need = useCallback((list: string[]) => {
    const missing = [...new Set(list.map((m) => m.toUpperCase()))].filter((m) => m && !asked.current.has(m));
    if (!missing.length) return;
    missing.forEach((m) => asked.current.add(m));
    void campaignAdminApi.facts(missing).then((r) => setFacts((f) => ({ ...f, ...r.facts }))).catch(() => missing.forEach((m) => asked.current.delete(m)));
  }, []);
  const key = mas.join(",");
  useEffect(() => {
    if (key) need(key.split(","));
  }, [key, need]);
  return { facts, need };
}

export function CampaignWizard({ id, canManage, onBack, onPublished, initialStep = 0 }: Props) {
  const { doc, content, errors, state, update, flush, replaceDoc } = useCampaignDraft(id);
  const [step, setStep] = useState(initialStep);
  const mas = (content?.products || []).flatMap((p) => [p.ma, ...rowGifts(p).map((g) => g.ma)]);
  const { facts, need } = useFacts(mas);
  if (!doc || !content) return <div className="flex justify-center py-16"><Spin /></div>;

  const locked = !canManage;
  const stepHasError = (i: number) => errors.some((e) => stepOfPath(e.path) === i);
  const go = (i: number) => {
    void flush();
    setStep(i);
  };
  const common = { content, update, locked, errors };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void flush().then(onBack)}
              className="inline-flex items-center gap-1.5 px-3 !h-9 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft size={14} /> Danh sách chiến dịch
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {content.info.name || "Chiến dịch mới"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <SaveBadge state={state} />
            <Button
              onClick={() => void flush()}
              className="!h-9 !rounded-lg px-3.5 text-xs font-medium border-slate-300"
            >
              Lưu nháp
            </Button>
          </div>
        </div>

        {/* Stepper Navigation: Responsive */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          {/* Desktop Stepper */}
          <div className="hidden md:grid md:grid-cols-5 gap-2">
            {STEPS.map((s, i) => {
              const active = step === i;
              const completed = step > i;
              const hasErr = stepHasError(i);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => go(i)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                    active
                      ? "bg-emerald-50/80 border border-emerald-300 text-[#2D5A27] shadow-xs"
                      : "hover:bg-slate-50 border border-transparent text-slate-600"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      hasErr
                        ? "bg-red-500 text-white"
                        : completed
                        ? "bg-[#2D5A27] text-white"
                        : active
                        ? "bg-[#2D5A27] text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {hasErr ? "!" : completed ? <Check size={13} /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${active ? "text-[#2D5A27]" : "text-slate-800"}`}>
                      {s.title}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {i === 0 && "Thời gian & URL"}
                      {i === 1 && "SP & Mức giảm"}
                      {i === 2 && "Voucher áp dụng"}
                      {i === 3 && "Banner & Giao diện"}
                      {i === 4 && "Kiểm tra & Bật"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile Stepper: Clean compact indicator + horizontal chips */}
          <div className="block md:hidden space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Bước {step + 1}/{STEPS.length}: <span className="text-[#2D5A27]">{STEPS[step].title}</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {Math.round(((step + 1) / STEPS.length) * 100)}% hoàn thành
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2D5A27] transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 text-xs">
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => go(i)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    step === i
                      ? "bg-[#2D5A27] text-white font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {i + 1}. {s.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Step Body */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs min-h-[360px]">
        {step === 0 ? <WhenStep {...common} /> : null}
        {step === 1 ? <ProductsStep {...common} facts={facts} onNeedFacts={need} /> : null}
        {step === 2 ? <VouchersStep {...common} /> : null}
        {step === 3 ? <DisplayStep content={content} update={update} errors={errors} /> : null}
        {step === 4 ? (
          <ReviewStep
            doc={{ ...doc, draft: content }}
            canManage={canManage}
            flush={flush}
            onJump={setStep}
            onDone={(d) => {
              replaceDoc(d);
              onPublished(d);
            }}
          />
        ) : null}

        {/* Step Navigation Footer */}
        {step < 4 ? (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6">
            <Button
              disabled={step === 0}
              onClick={() => go(step - 1)}
              className="!h-9 !rounded-lg px-4 text-xs font-medium"
            >
              ← Quay lại
            </Button>
            <Button
              type="primary"
              onClick={() => go(step + 1)}
              className="!h-9 !rounded-lg px-4 !bg-[#2D5A27] hover:!bg-[#23481e] font-bold text-xs shadow-xs text-white"
            >
              Tiếp tục: {STEPS[step + 1]?.title} →
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
