"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { wbInput, WbBtn, WbLoading, WbToggle } from "@/components/admin/website/ui";
import { SeoEditorLayout } from "../SeoEditorLayout";
import { seoRedirectSchema, type SeoRedirectInput } from "../schemas";
import {
  useCreateRedirect,
  useDeleteRedirect,
  usePatchRedirect,
  useSeoRedirects,
} from "../seoQueries";

export function SeoRedirectsPanel() {
  const list = useSeoRedirects();
  const create = useCreateRedirect();
  const patch = usePatchRedirect();
  const del = useDeleteRedirect();

  const form = useForm<SeoRedirectInput>({
    resolver: zodResolver(seoRedirectSchema),
    defaultValues: { fromPath: "", toPath: "", note: "" },
  });

  const onAdd = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values);
      form.reset({ fromPath: "", toPath: "", note: "" });
      toast.success("Đã thêm redirect");
    } catch (e: any) {
      toast.error(e?.message || "Thêm thất bại");
    }
  });

  return (
    <SeoEditorLayout
      crumb="Chuyển hướng 301"
      title="Chuyển hướng 301"
      preview={
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-600">
          Dùng khi đổi slug, đổi domain hoặc URL cũ từ KiotViet. Google và khách
          vào link cũ sẽ được chuyển sang URL mới.
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onAdd();
        }}
        className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input
          className={wbInput}
          placeholder="/duong-dan-cu"
          {...form.register("fromPath")}
        />
        <input
          className={wbInput}
          placeholder="/duong-dan-moi"
          {...form.register("toPath")}
        />
        <WbBtn type="submit" variant="primary" disabled={create.isPending}>
          Thêm
        </WbBtn>
      </form>
      {(form.formState.errors.fromPath || form.formState.errors.toPath) && (
        <p className="text-[12px] text-red-600">
          {form.formState.errors.fromPath?.message ||
            form.formState.errors.toPath?.message}
        </p>
      )}

      {list.isLoading ? (
        <WbLoading label="Đang tải redirect…" />
      ) : !list.data?.items?.length ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-[13px] text-slate-500">
          Chưa có redirect — thêm khi đổi slug hoặc domain
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Từ</th>
                <th className="px-3 py-2 font-semibold">Đến</th>
                <th className="px-3 py-2 font-semibold">Bật</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="max-w-[140px] truncate px-3 py-2 font-mono text-[12px]">
                    {row.fromPath}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 font-mono text-[12px]">
                    {row.toPath}
                  </td>
                  <td className="px-3 py-2">
                    <WbToggle
                      on={row.enabled}
                      onChange={() =>
                        void patch
                          .mutateAsync({
                            id: row.id,
                            patch: { enabled: !row.enabled },
                          })
                          .catch((e) => toast.error(e?.message || "Lỗi"))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      onClick={() =>
                        void del
                          .mutateAsync(row.id)
                          .then(() => toast.success("Đã xóa"))
                          .catch((e) => toast.error(e?.message || "Lỗi"))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SeoEditorLayout>
  );
}
