"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/components/admin/toast";
import { wbInput } from "@/components/admin/website/ui";
import { fetchProducts, formatVnd, type ShopProduct } from "@/lib/api";
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

function productImage(p?: ShopProduct | null): string {
  if (!p) return "";
  const a = String(p.anh || "").trim();
  if (a) return a;
  if (Array.isArray(p.images) && p.images[0]) return String(p.images[0]).trim();
  return "";
}

export function SeoProductPanel() {
  const q = useSeoAppearanceDraft();
  const save = useSaveSeoDraft();
  const publish = usePublishSeo();
  const seo = q.data?.draft?.theme?.seo;
  const siteName = q.data?.draft?.theme?.siteName || "ALOHA Thế Giới Chậu Cây";

  /** SP dùng để xem trước (ảnh + biến) — độc lập với nội dung template. */
  const [sampleQ, setSampleQ] = useState("KCL1");
  const [sampleMa, setSampleMa] = useState("KCL1");

  const sampleSearch = useQuery({
    queryKey: ["admin", "seo", "sample-search", sampleQ],
    queryFn: () => fetchProducts({ q: sampleQ.trim() || "KCL1", limit: 8 }),
    staleTime: 30_000,
    enabled: sampleQ.trim().length >= 1,
  });

  const sampleItem = useMemo(() => {
    const items = sampleSearch.data?.items || [];
    const byMa = items.find(
      (p) => String(p.ma || "").toUpperCase() === sampleMa.toUpperCase()
    );
    return byMa || items[0] || null;
  }, [sampleSearch.data, sampleMa]);

  useEffect(() => {
    const items = sampleSearch.data?.items || [];
    if (!items.length) return;
    const stillThere = items.some(
      (p) => String(p.ma || "").toUpperCase() === sampleMa.toUpperCase()
    );
    if (!stillThere && items[0]?.ma) setSampleMa(String(items[0].ma));
  }, [sampleSearch.data, sampleMa]);

  const sampleImage = productImage(sampleItem);

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
  const previewPath = sampleItem?.path || "/c/chau-trong-cay/p/chau-kim-cuong-lun";

  const looksHardcoded = useMemo(() => {
    const t = watched.productTitleTemplate || "";
    const d = watched.productDescriptionTemplate || "";
    return !t.includes("[") && !d.includes("[") && (t.length > 20 || d.length > 20);
  }, [watched.productTitleTemplate, watched.productDescriptionTemplate]);

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
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500">
              Xem trước với sản phẩm
            </label>
            <input
              className={wbInput}
              value={sampleQ}
              onChange={(e) => setSampleQ(e.target.value)}
              placeholder="Tìm mã hoặc tên SP… (vd. CBDVDP)"
            />
            {(sampleSearch.data?.items?.length || 0) > 0 ? (
              <select
                className={wbInput}
                value={sampleItem?.ma || ""}
                onChange={(e) => setSampleMa(e.target.value)}
              >
                {(sampleSearch.data?.items || []).map((p) => (
                  <option key={p.ma} value={p.ma}>
                    {p.ma} — {p.ten}
                  </option>
                ))}
              </select>
            ) : null}
            <p className="text-[11px] text-slate-500">
              Ảnh MXH = ảnh đầu của SP đang chọn
              {sampleItem?.ten ? `: ${sampleItem.ten}` : ""}.
            </p>
          </div>
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
        Màn này chỉnh <strong>template chung</strong> cho mọi SP (dùng biến như{" "}
        <code className="rounded bg-white/80 px-1">[Tên sản phẩm]</code>). Gõ tên
        một SP vào ô bên trái <em>không</em> đổi ảnh — hãy chọn SP ở cột xem
        trước bên phải. SEO riêng từng SP: tab Hàng hóa web.
      </div>

      {looksHardcoded ? (
        <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-950 ring-1 ring-amber-100">
          Đang nhập chữ cố định (vd. Combo Đế Vương…). Nên dùng biến để mọi SP
          tự điền, ví dụ:{" "}
          <code className="rounded bg-white/80 px-1">
            [Tên sản phẩm] | [Giá] · [Tên cửa hàng]
          </code>
          . Còn SEO riêng Combo Đế Vương → Hàng hóa web → SEO mã CBDVDP.
        </div>
      ) : null}

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
