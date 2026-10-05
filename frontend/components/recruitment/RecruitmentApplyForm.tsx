"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Paperclip, UserRound, X } from "lucide-react";
import { useShopMeQuery } from "@/lib/authQueries";
import { shopLoginHref } from "@/lib/auth";
import {
  EXPERIENCE_LEVEL_LABELS,
  RECRUITMENT_PRIVACY_PATH,
  formatLocation,
  newIdempotencyKey,
  type ApplicationSource,
  type ApplyJobTarget,
  type RecruitmentFormOptions,
} from "@/lib/recruitment";
import {
  buildApplySchema,
  cvFileError,
  readFileAsDataUrl,
  serverFieldToFormField,
  type ApplyFormValues,
} from "./applyFormSchema";

const inputCls =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--aloha-green)] focus:ring-2 focus:ring-[var(--aloha-green)]/20 aria-[invalid=true]:border-red-400";

function Field({
  id,
  label,
  required,
  error,
  className = "",
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Email hệ thống tạo sẵn cho CTV (không phải hộp thư thật) — không điền sẵn. */
const isSystemEmail = (email: string) => /\.local$/i.test(email);

export function RecruitmentApplyForm({
  options,
  job,
  source,
  positionSuggestions = [],
  loginReturnPath,
  idPrefix = "rf",
}: {
  options: RecruitmentFormOptions;
  job?: ApplyJobTarget;
  source?: ApplicationSource;
  positionSuggestions?: string[];
  /** Có giá trị thì khách chưa đăng nhập thấy link "Đăng nhập để điền nhanh" quay về đây. */
  loginReturnPath?: string;
  idPrefix?: string;
}) {
  const general = !job;
  const cvRequired = Boolean(job?.cvRequired && options.cvEnabled);
  const summaryRequired = Boolean(job?.cvRequired && !options.cvEnabled);
  const locations = job ? job.locations : options.locations;
  const schema = useMemo(() => buildApplySchema({ general, summaryRequired }), [general, summaryRequired]);
  const keyRef = useRef<string | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const prefilledFor = useRef<string | null>(null);
  const datalistId = useId();
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState("");
  const [rootError, setRootError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ publicCode: string } | null>(null);
  const { data: me, isFetched: meFetched } = useShopMeQuery();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ApplyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      location: locations.length ? "" : "any",
      interestedPosition: job?.title || "",
      experienceLevel: "",
      experienceSummary: "",
      consent: false,
    },
  });

  useEffect(() => {
    const sub = watch(() => {
      keyRef.current = null;
    });
    return () => sub.unsubscribe();
  }, [watch]);

  useEffect(() => {
    if (!me || prefilledFor.current === me.id) return;
    prefilledFor.current = me.id;
    const fill = (k: "fullName" | "email" | "phone", v: string | null | undefined) => {
      const val = String(v || "").trim();
      if (val && !String(getValues(k) || "").trim()) setValue(k, val);
    };
    fill("fullName", me.fullName);
    if (!isSystemEmail(me.email || "")) fill("email", me.email);
    fill("phone", me.phone);
  }, [me, getValues, setValue]);

  const clearCv = () => {
    keyRef.current = null;
    setCvFile(null);
    setCvError("");
    if (cvInputRef.current) cvInputRef.current.value = "";
  };

  const onCvChange = (file: File | null) => {
    keyRef.current = null;
    setCvError("");
    if (!file) {
      setCvFile(null);
      return;
    }
    const problem = cvFileError(file, options);
    if (problem) {
      setCvError(problem);
      setCvFile(null);
      if (cvInputRef.current) cvInputRef.current.value = "";
      return;
    }
    setCvFile(file);
  };

  const onSubmit = handleSubmit(async (values) => {
    setRootError("");
    if (cvRequired && !cvFile) {
      setCvError("Vị trí này yêu cầu đính kèm CV");
      cvInputRef.current?.focus();
      return;
    }
    setPending(true);
    try {
      if (!keyRef.current) keyRef.current = newIdempotencyKey();
      let cvData: string | null = null;
      if (cvFile) {
        try {
          cvData = await readFileAsDataUrl(cvFile);
        } catch {
          setCvError("Không đọc được file CV. Chọn lại file.");
          return;
        }
      }
      const body = {
        submissionType: general ? "general_interest" : "job_application",
        ...(source ? { source } : {}),
        ...(job ? { jobId: job.id } : { interestedPosition: values.interestedPosition }),
        locationPreference:
          values.location === "any" ? { mode: "any" } : { mode: "selected", keys: [values.location] },
        experienceLevel: values.experienceLevel,
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        experienceSummary: values.experienceSummary,
        ...(cvFile && cvData ? { cv: { name: cvFile.name, data: cvData } } : {}),
        consent: {
          accepted: true,
          purpose: general ? "recruitment_contact" : "specific_job",
          noticeVersion: options.noticeVersion,
        },
      };
      let res: Response;
      try {
        res = await fetch("/api/shop/recruitment/applications", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "Idempotency-Key": keyRef.current },
          body: JSON.stringify(body),
        });
      } catch {
        setRootError("Mất kết nối mạng. Thông tin vẫn được giữ — kiểm tra mạng rồi bấm Gửi lại.");
        return;
      }
      if (res.status === 413) {
        setCvError(`File quá lớn — CV tối đa ${Math.round(options.cvMaxBytes / 1048576)}MB`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        publicCode?: string;
        field?: string;
        error?: string;
        message?: string;
      };
      if (res.ok && data.publicCode) {
        setDone({ publicCode: data.publicCode });
        return;
      }
      if (data.error === "idempotency_conflict") keyRef.current = null;
      const target = data.field ? serverFieldToFormField(data.field) : null;
      const msg = data.message || "Không gửi được. Vui lòng thử lại.";
      if (target === "cv") {
        setCvError(msg);
        cvInputRef.current?.focus();
      } else if (target) {
        setError(target, { message: msg }, { shouldFocus: true });
      } else {
        setRootError(msg);
      }
    } finally {
      setPending(false);
    }
  });

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-[var(--aloha-line)] sm:p-8" role="status">
        <CheckCircle2 className="mx-auto text-[var(--aloha-green)]" size={44} strokeWidth={1.75} />
        <h3 className="mt-3 text-lg font-extrabold text-[var(--aloha-green-dark)]">
          {general ? "Aloha đã nhận thông tin của bạn" : `Đã gửi hồ sơ ứng tuyển ${job?.title}`}
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Mã biên nhận: <strong className="font-mono text-base text-slate-900">{done.publicCode}</strong>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {general
            ? "Aloha sẽ liên hệ qua email hoặc điện thoại khi có công việc phù hợp."
            : "Bộ phận tuyển dụng sẽ xem hồ sơ và liên hệ qua email hoặc điện thoại nếu hồ sơ phù hợp."}{" "}
          Giữ mã biên nhận khi cần liên hệ Aloha.
        </p>
      </div>
    );
  }

  const err = (k: keyof ApplyFormValues) => errors[k]?.message as string | undefined;
  const fid = (k: string) => `${idPrefix}-${k}`;
  const aria = (k: keyof ApplyFormValues) => ({
    "aria-invalid": Boolean(errors[k]),
    "aria-describedby": errors[k] ? `${fid(k)}-error` : undefined,
  });
  const maxMb = Math.round(options.cvMaxBytes / 1048576);

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
      {me ? (
        <p className="flex items-start gap-2 rounded-xl bg-[var(--aloha-green)]/10 px-3.5 py-2.5 text-sm text-slate-700 md:col-span-2">
          <UserRound size={16} className="mt-0.5 shrink-0 text-[var(--aloha-green-dark)]" aria-hidden />
          <span>
            Đã điền sẵn từ tài khoản <strong>{me.fullName || me.email}</strong>. Bạn có thể sửa trước khi gửi — thay
            đổi ở đây không cập nhật tài khoản.
          </span>
        </p>
      ) : meFetched && loginReturnPath ? (
        <p className="text-sm text-slate-600 md:col-span-2">
          Đã có tài khoản Aloha?{" "}
          <Link href={shopLoginHref(loginReturnPath)} className="font-semibold text-[var(--aloha-green-dark)] underline">
            Đăng nhập để điền nhanh
          </Link>{" "}
          — không bắt buộc, bạn vẫn có thể nộp ngay.
        </p>
      ) : null}

      <Field id={fid("fullName")} label="Họ và tên" required error={err("fullName")}>
        <input id={fid("fullName")} className={inputCls} placeholder="Họ và tên" autoComplete="name" {...aria("fullName")} {...register("fullName")} />
      </Field>
      <Field id={fid("location")} label="Nơi làm việc" required error={err("location")}>
        <select id={fid("location")} className={inputCls} {...aria("location")} {...register("location")}>
          {locations.length ? <option value="">Chọn nơi làm việc</option> : null}
          <option value="any">{job ? "Bất kỳ nơi nào của tin này" : "Tất cả"}</option>
          {locations.map((l) => (
            <option key={l.key} value={l.key}>
              {formatLocation(l)}
            </option>
          ))}
        </select>
      </Field>
      <Field id={fid("email")} label="Email" required error={err("email")}>
        <input
          id={fid("email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="example@email.com"
          className={inputCls}
          {...aria("email")}
          {...register("email")}
        />
      </Field>
      <Field id={fid("interestedPosition")} label="Công việc/Vị trí bạn quan tâm" required error={err("interestedPosition")}>
        <input
          id={fid("interestedPosition")}
          className={`${inputCls} ${job ? "bg-slate-50 text-slate-600" : ""}`}
          readOnly={Boolean(job)}
          placeholder="Nhập công việc"
          list={!job && positionSuggestions.length ? datalistId : undefined}
          {...aria("interestedPosition")}
          {...register("interestedPosition")}
        />
        {!job && positionSuggestions.length ? (
          <datalist id={datalistId}>
            {positionSuggestions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        ) : null}
      </Field>
      <Field id={fid("phone")} label="Số điện thoại" required error={err("phone")}>
        <input
          id={fid("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Số điện thoại"
          className={inputCls}
          {...aria("phone")}
          {...register("phone")}
        />
      </Field>
      <Field id={fid("experienceLevel")} label="Kinh nghiệm" required error={err("experienceLevel")}>
        <select id={fid("experienceLevel")} className={inputCls} {...aria("experienceLevel")} {...register("experienceLevel")}>
          <option value="">Kinh nghiệm</option>
          {options.experienceLevels.map((v) => (
            <option key={v} value={v}>
              {EXPERIENCE_LEVEL_LABELS[v]}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id={fid("experienceSummary")}
        label="Mô tả kinh nghiệm"
        required={summaryRequired}
        error={err("experienceSummary")}
        className="md:col-span-2"
      >
        <textarea
          id={fid("experienceSummary")}
          rows={3}
          maxLength={5000}
          placeholder={summaryRequired ? "Công việc đã làm, kỹ năng nổi bật…" : "Công việc đã làm, kỹ năng nổi bật… (không bắt buộc)"}
          className={`${inputCls} h-auto py-2.5`}
          {...aria("experienceSummary")}
          {...register("experienceSummary")}
        />
      </Field>

      {options.cvEnabled ? (
        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor={fid("cv")}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-[var(--aloha-green-dark)] px-5 text-[15px] font-semibold text-white shadow-sm transition hover:bg-[var(--aloha-green)] focus-within:ring-2 focus-within:ring-[var(--aloha-green)]/40"
            >
              <Paperclip size={16} aria-hidden />
              {cvFile ? "Đổi file CV" : "Đính kèm CV"}
              {cvRequired ? <span className="text-[#ffe566]">*</span> : null}
            </label>
            {cvFile ? (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm text-slate-700">
                <span className="truncate">{cvFile.name}</span>
                <button
                  type="button"
                  onClick={clearCv}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-slate-200"
                  aria-label="Bỏ file CV"
                >
                  <X size={14} />
                </button>
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                PDF, DOC, DOCX · tối đa {maxMb}MB{cvRequired ? "" : " · không bắt buộc"}
              </span>
            )}
          </div>
          <input
            ref={cvInputRef}
            id={fid("cv")}
            type="file"
            accept={[...options.cvAcceptExts, ...options.cvAcceptMimes].join(",")}
            className="sr-only"
            aria-invalid={Boolean(cvError)}
            aria-describedby={cvError ? `${fid("cv")}-error` : undefined}
            onChange={(e) => onCvChange(e.target.files?.[0] || null)}
          />
          {cvError ? (
            <p id={`${fid("cv")}-error`} className="mt-1 text-xs font-medium text-red-600" role="alert">
              {cvError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="md:col-span-2">
        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--aloha-green)]" {...aria("consent")} {...register("consent")} />
          <span>
            Bằng việc gửi thông tin {general ? "" : "ứng tuyển "}đến Aloha, tôi xác nhận đã đọc, hiểu rõ và đồng ý với{" "}
            <Link href={RECRUITMENT_PRIVACY_PATH} target="_blank" className="font-semibold text-[var(--aloha-green-dark)] underline">
              thông báo xử lý dữ liệu tuyển dụng
            </Link>{" "}
            cho mục đích {general ? "liên hệ khi có cơ hội việc làm phù hợp" : `ứng tuyển vị trí ${job?.title}`}.
            <span className="text-red-600"> *</span>
          </span>
        </label>
        {err("consent") ? (
          <p id={`${fid("consent")}-error`} className="mt-1 text-xs font-medium text-red-600" role="alert">
            {err("consent")}
          </p>
        ) : null}
      </div>
      {rootError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100 md:col-span-2" role="alert">
          {rootError}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--aloha-green-dark)] px-8 text-[15px] font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)] disabled:cursor-wait disabled:opacity-60 md:w-auto"
        >
          {pending ? "Đang gửi…" : "Gửi hồ sơ"}
        </button>
      </div>
    </form>
  );
}
