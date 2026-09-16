"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/components/admin/toast";
import { wbInput } from "@/components/admin/website/ui";
import { fetchProducts, formatVnd } from "@/lib/api";
import { applySeoTemplate, PRODUCT_SEO_VARS, productSeoVars } from "@/lib/seoTemplates";
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
import { seoProductTplSchema, type SeoProductTplInput } from "../schemas";
import {
  usePublishSeo,
  useSaveSeoDraft,
  useSeoAppearanceDraft,
} from "../seoQueries";

function insertAtEnd(cur: string, token: string) {
  return `${cur || ""}${token}`;
}

export function SeoProductPanel() {
  const q = useSeoAppearanceDraft();
  const save = useSaveSeoDraft();
  const publish = usePublishSeo();
  const seo = q.data?.draft?.theme?.seo;
  const siteName = q.data?.draft?.theme?.siteName || "ALOHA Thế Giới Chậu Cây";

  const sampleProduct = useQuery({
    queryKey: ["admin", "seo", "sample-product", "KCL1"],
    queryFn: async () => {
      // Mã thật trên shop là KCL1 (không phải CKCL01).
      const byMa = await fetchProducts({ q: "KCL1", limit: 3 });
      const hit =
        byMa.items?.find((p) => String(p.ma || "").toUpperCase() === "KCL1") ||
        byMa.items?.[0];
      if (hit?.anh || (hit?.images && hit.images[0])) return { items: [hit] };
      const byName = await fetchProducts({ q: "kim cuong lun", limit: 1 });
      return byName;
    },
    staleTime: 60_000,
  });
  const sampleItem = sampleProduct.data?.items?.[0];
  const sampleImage =
    String(sampleItem?.anh || "").trim() ||
    (Array.isArray(sampleItem?.images)
      ? String(sampleItem.images[0] || "").trim()
      : "") ||
    "";

  const form = useForm<SeoProductTplInput>({
    resolver: zodResolver(seoProductTplSchema),
    defaultValues: {
      productTitleTemplate: "",
      productDescriptionTemplate: "",
    },
  });

  useEffect(() => {
    if (!seo) return;
    form.reset({
      productTitleTemplate: seo.productTitleTemplate || "",
      productDescriptionTemplate: seo.productDescriptionTemplate || "",
    });
  }, [seo, form]);

  const watched = form.watch();
  const sampleVars = useMemo(
    () =>
      productSeoVars({
        ten: sampleItem?.ten || "CHẬU KIM CƯƠNG LÙN",
        gia: formatVnd(Number(sampleItem?.gia) || 46000),
        ma: sampleItem?.ma || "KCL1",
        danhMuc: sampleItem?.nhom || sampleItem?.categoryName || "Chậu trồng cây",
        tenCuaHang: siteName,
      }),
    [sampleItem, siteName]
  );

  const previewTitle = applySeoTemplate(
    watched.productTitleTemplate || "",
    sampleVars
  );
  const previewDesc = applySeoTemplate(
    watched.productDescriptionTemplate || "",
    sampleVars
  );
  const previewPath =
    sampleItem?.path || "/c/chau-trong-cay/p/chau-kim-cuong-lun";

  const onSave = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast.success("Đã lưu template SEO sản phẩm");
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
      crumb="Chi tiết hàng hóa"
      title="Chi tiết hàng hóa"
      onSave={() => void onSave()}
      onPublish={() => void onPublish()}
      saving={save.isPending}
      publishing={publish.isPending}
      dirty={q.data?.dirty}
      preview={
        <>
          <p className="text-[11px] text-slate-500">
            Xem với mẫu: {sampleItem?.ten || "CHẬU KIM CƯƠNG LÙN"} (ảnh = ảnh đầu
            SP)
          </p>
          <SeoGooglePreview
            title={previewTitle}
            description={previewDesc}
            path={previewPath}
          />
          <SeoSocialPreview
            title={previewTitle}
            description={previewDesc}
            imageUrl={sampleImage || undefined}
          />
        </>
      }
    >
      <div className="rounded-xl bg-sky-50 px-3 py-2.5 text-[12px] leading-relaxed text-sky-900 ring-1 ring-sky-100">
        Ảnh chia sẻ mặc định lấy từ ảnh đầu của sản phẩm. Có thể ghi đè title/mô
        tả từng SP trong tab Hàng hóa web. Màn này chỉ chỉnh{" "}
        <strong>template chung</strong> (dùng biến như [Tên sản phẩm]).
      </div>

      <SeoCharField
        label="Tiêu đề liên kết"
        required
        error={form.formState.errors.productTitleTemplate?.message}
        meter={
          <span className="flex items-center gap-2">
            <SeoVarPopover
              vars={PRODUCT_SEO_VARS}
              onPick={(v) =>
                form.setValue(
                  "productTitleTemplate",
                  insertAtEnd(form.getValues("productTitleTemplate"), v),
                  { shouldDirty: true }
                )
              }
            />
            <SeoCharMeter
              value={watched.productTitleTemplate || ""}
              max={120}
              softIdeal={70}
            />
          </span>
        }
      >
        <input className={wbInput} {...form.register("productTitleTemplate")} />
      </SeoCharField>
      <p className="text-[11px] text-slate-500">Tốt nhất từ 50–100 ký tự sau khi thay biến</p>

      <SeoCharField
        label="Mô tả liên kết"
        required
        error={form.formState.errors.productDescriptionTemplate?.message}
        meter={
          <span className="flex items-center gap-2">
            <SeoVarPopover
              vars={PRODUCT_SEO_VARS}
              onPick={(v) =>
                form.setValue(
                  "productDescriptionTemplate",
                  insertAtEnd(form.getValues("productDescriptionTemplate"), v),
                  { shouldDirty: true }
                )
              }
            />
            <SeoCharMeter
              value={watched.productDescriptionTemplate || ""}
              max={320}
              softIdeal={180}
            />
          </span>
        }
      >
        <textarea
          className={`${wbInput} min-h-[88px] resize-y py-2`}
          {...form.register("productDescriptionTemplate")}
        />
      </SeoCharField>
      <p className="text-[11px] text-slate-500">Tốt nhất từ 100–200 ký tự sau khi thay biến</p>
    </SeoEditorLayout>
  );
}
