"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/admin/toast";
import { wbInput, WbToggle } from "@/components/admin/website/ui";
import { ImageUploadField } from "@/components/admin/website/appearance/ImageUploadField";
import { SeoEditorLayout } from "../SeoEditorLayout";
import {
  SeoCharField,
  SeoCharMeter,
} from "../fields/SeoFieldBits";
import {
  SeoGooglePreview,
  SeoSocialPreview,
  SeoTabPreview,
} from "../previews/SeoPreviews";
import { seoHomeSchema, type SeoHomeInput } from "../schemas";
import {
  usePublishSeo,
  useSaveSeoDraft,
  useSeoAppearanceDraft,
} from "../seoQueries";

export function SeoHomePanel() {
  const q = useSeoAppearanceDraft();
  const save = useSaveSeoDraft();
  const publish = usePublishSeo();
  const seo = q.data?.draft?.theme?.seo;
  const favicon = q.data?.draft?.theme?.faviconUrl;

  const form = useForm<SeoHomeInput>({
    resolver: zodResolver(seoHomeSchema),
    defaultValues: {
      title: "",
      description: "",
      ogImageUrl: "",
      googleSiteVerification: "",
      enableProductJsonLd: true,
      enableOrgJsonLd: true,
    },
  });

  useEffect(() => {
    if (!seo) return;
    form.reset({
      title: seo.title || "",
      description: seo.description || "",
      ogImageUrl: seo.ogImageUrl || "",
      googleSiteVerification: seo.googleSiteVerification || "",
      enableProductJsonLd: seo.enableProductJsonLd !== false,
      enableOrgJsonLd: seo.enableOrgJsonLd !== false,
    });
  }, [seo, form]);

  const watched = form.watch();

  const onSave = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast.success("Đã lưu nháp SEO trang chủ");
    } catch (e: any) {
      toast.error(e?.message || "Lưu thất bại");
    }
  });

  const onPublish = async () => {
    const ok = await form.trigger();
    if (!ok) return;
    try {
      await save.mutateAsync(form.getValues());
      await publish.mutateAsync();
      toast.success("Đã xuất bản SEO");
    } catch (e: any) {
      toast.error(e?.message || "Xuất bản thất bại");
    }
  };

  return (
    <SeoEditorLayout
      crumb="Trang chủ"
      title="Trang chủ"
      onSave={() => void onSave()}
      onPublish={() => void onPublish()}
      saving={save.isPending}
      publishing={publish.isPending}
      dirty={q.data?.dirty}
      preview={
        <>
          <SeoGooglePreview
            title={watched.title}
            description={watched.description}
            path="/"
          />
          <SeoTabPreview title={watched.title} faviconUrl={favicon} />
          <SeoSocialPreview
            title={watched.title}
            description={watched.description}
            imageUrl={watched.ogImageUrl}
          />
        </>
      }
    >
      <SeoCharField
        label="Tiêu đề liên kết"
        required
        error={form.formState.errors.title?.message}
        meter={<SeoCharMeter value={watched.title || ""} max={100} softIdeal={60} />}
      >
        <input className={wbInput} {...form.register("title")} />
      </SeoCharField>

      <SeoCharField
        label="Mô tả liên kết"
        required
        error={form.formState.errors.description?.message}
        meter={
          <SeoCharMeter value={watched.description || ""} max={200} softIdeal={160} />
        }
      >
        <textarea
          className={`${wbInput} min-h-[88px] resize-y py-2`}
          {...form.register("description")}
        />
      </SeoCharField>

      <div className="space-y-2">
        <p className="text-[13px] font-semibold text-slate-800">Hình ảnh khi chia sẻ</p>
        <p className="text-[11px] text-slate-500">
          Kích thước đề xuất ~1200×630 (tỷ lệ gần 1.91:1)
        </p>
        <ImageUploadField
          kind="banner"
          value={watched.ogImageUrl || ""}
          onChange={(url) => form.setValue("ogImageUrl", url, { shouldDirty: true })}
          hint="Ảnh OG · tối đa 4MB"
        />
      </div>

      <SeoCharField label="Google site verification">
        <input
          className={wbInput}
          placeholder="Mã content từ Search Console"
          {...form.register("googleSiteVerification")}
        />
      </SeoCharField>

      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-slate-700">
            Product JSON-LD
          </span>
          <WbToggle
            on={watched.enableProductJsonLd}
            onChange={() =>
              form.setValue("enableProductJsonLd", !watched.enableProductJsonLd, {
                shouldDirty: true,
              })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-slate-700">
            LocalBusiness / Organization JSON-LD
          </span>
          <WbToggle
            on={watched.enableOrgJsonLd}
            onChange={() =>
              form.setValue("enableOrgJsonLd", !watched.enableOrgJsonLd, {
                shouldDirty: true,
              })
            }
          />
        </div>
      </div>
    </SeoEditorLayout>
  );
}
