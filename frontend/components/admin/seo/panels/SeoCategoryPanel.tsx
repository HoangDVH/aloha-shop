"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/admin/toast";
import { wbInput } from "@/components/admin/website/ui";
import {
  applySeoTemplate,
  CATEGORY_SEO_VARS,
  categorySeoVars,
} from "@/lib/seoTemplates";
import { SeoEditorLayout } from "../SeoEditorLayout";
import {
  SeoCharField,
  SeoCharMeter,
  SeoVarPopover,
} from "../fields/SeoFieldBits";
import {
  SeoGooglePreview,
  SeoSocialPreview,
} from "../previews/SeoPreviews";
import { seoCategoryTplSchema, type SeoCategoryTplInput } from "../schemas";
import {
  usePublishSeo,
  useSaveSeoDraft,
  useSeoAppearanceDraft,
} from "../seoQueries";

function insertAtEnd(cur: string, token: string) {
  return `${cur || ""}${token}`;
}

export function SeoCategoryPanel() {
  const q = useSeoAppearanceDraft();
  const save = useSaveSeoDraft();
  const publish = usePublishSeo();
  const seo = q.data?.draft?.theme?.seo;
  const siteName = q.data?.draft?.theme?.siteName || "ALOHA Thế Giới Chậu Cây";

  const form = useForm<SeoCategoryTplInput>({
    resolver: zodResolver(seoCategoryTplSchema),
    defaultValues: {
      categoryTitleTemplate: "",
      categoryDescriptionTemplate: "",
    },
  });

  useEffect(() => {
    if (!seo) return;
    form.reset({
      categoryTitleTemplate: seo.categoryTitleTemplate || "",
      categoryDescriptionTemplate: seo.categoryDescriptionTemplate || "",
    });
  }, [seo, form]);

  const watched = form.watch();
  const sampleVars = useMemo(
    () =>
      categorySeoVars({
        tenDanhMuc: "Chậu trồng cây",
        tenCuaHang: siteName,
      }),
    [siteName]
  );
  const previewTitle = applySeoTemplate(
    watched.categoryTitleTemplate || "",
    sampleVars
  );
  const previewDesc = applySeoTemplate(
    watched.categoryDescriptionTemplate || "",
    sampleVars
  );

  const onSave = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast.success("Đã lưu template SEO danh mục");
    } catch (e: any) {
      toast.error(e?.message || "Lưu thất bại");
    }
  });

  const onPublish = async () => {
    if (!(await form.trigger())) return;
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
      crumb="Danh mục hàng hóa"
      title="Danh mục hàng hóa"
      onSave={() => void onSave()}
      onPublish={() => void onPublish()}
      saving={save.isPending}
      publishing={publish.isPending}
      dirty={q.data?.dirty}
      preview={
        <>
          <SeoGooglePreview
            title={previewTitle}
            description={previewDesc}
            path="/danh-muc/chau-trong-cay"
          />
          <SeoSocialPreview
            title={previewTitle}
            description={previewDesc}
            imageUrl="/brand/logo-aloha.png"
          />
        </>
      }
    >
      <div className="rounded-xl bg-sky-50 px-3 py-2.5 text-[12px] leading-relaxed text-sky-900 ring-1 ring-sky-100">
        Ảnh chia sẻ mặc định lấy từ ảnh sản phẩm đầu trong danh mục khi có.
      </div>

      <SeoCharField
        label="Tiêu đề liên kết"
        required
        error={form.formState.errors.categoryTitleTemplate?.message}
        meter={
          <span className="flex items-center gap-2">
            <SeoVarPopover
              vars={CATEGORY_SEO_VARS}
              onPick={(v) =>
                form.setValue(
                  "categoryTitleTemplate",
                  insertAtEnd(form.getValues("categoryTitleTemplate"), v),
                  { shouldDirty: true }
                )
              }
            />
            <SeoCharMeter
              value={watched.categoryTitleTemplate || ""}
              max={120}
              softIdeal={70}
            />
          </span>
        }
      >
        <input className={wbInput} {...form.register("categoryTitleTemplate")} />
      </SeoCharField>
      <p className="text-[11px] text-slate-500">Tốt nhất từ 50–100 ký tự</p>

      <SeoCharField
        label="Mô tả liên kết"
        required
        error={form.formState.errors.categoryDescriptionTemplate?.message}
        meter={
          <span className="flex items-center gap-2">
            <SeoVarPopover
              vars={CATEGORY_SEO_VARS}
              onPick={(v) =>
                form.setValue(
                  "categoryDescriptionTemplate",
                  insertAtEnd(form.getValues("categoryDescriptionTemplate"), v),
                  { shouldDirty: true }
                )
              }
            />
            <SeoCharMeter
              value={watched.categoryDescriptionTemplate || ""}
              max={320}
              softIdeal={180}
            />
          </span>
        }
      >
        <textarea
          className={`${wbInput} min-h-[88px] resize-y py-2`}
          {...form.register("categoryDescriptionTemplate")}
        />
      </SeoCharField>
      <p className="text-[11px] text-slate-500">Tốt nhất từ 100–200 ký tự</p>
    </SeoEditorLayout>
  );
}
