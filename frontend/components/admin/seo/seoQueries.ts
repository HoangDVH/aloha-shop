import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { websiteApi, type AppearanceLayout } from "@/components/admin/website/api";
import type { AppearanceSeo } from "@/lib/appearanceTypes";

const SEO_APPEARANCE_KEY = ["admin", "seo", "appearance"] as const;
const SEO_REDIRECTS_KEY = ["admin", "seo", "redirects"] as const;

type AppearanceAdminRes = {
  draft: AppearanceLayout;
  published: AppearanceLayout;
  publishedAt?: string | null;
  dirty?: boolean;
  scheduledPublishAt?: string | null;
};

export type SeoRedirectRow = {
  id: string;
  fromPath: string;
  toPath: string;
  enabled: boolean;
  note: string;
  updatedAt?: string | null;
};

export function useSeoAppearanceDraft() {
  return useQuery({
    queryKey: SEO_APPEARANCE_KEY,
    queryFn: () => websiteApi<AppearanceAdminRes>("/api/shop/admin/appearance"),
    staleTime: 15_000,
  });
}

export function useSaveSeoDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seoPatch: Partial<AppearanceSeo>) => {
      const cur = qc.getQueryData<AppearanceAdminRes>(SEO_APPEARANCE_KEY);
      const draft = cur?.draft;
      if (!draft) throw new Error("Chưa tải được bản nháp");
      const nextSeo = { ...(draft.theme.seo || {}), ...seoPatch };
      return websiteApi<{ ok: boolean; draft: AppearanceLayout }>(
        "/api/shop/admin/appearance/draft",
        {
          method: "PUT",
          body: JSON.stringify({
            version: draft.version,
            theme: { ...draft.theme, seo: nextSeo },
            blocks: draft.blocks,
            nav: draft.nav,
          }),
        }
      );
    },
    onSuccess: (data) => {
      qc.setQueryData<AppearanceAdminRes>(SEO_APPEARANCE_KEY, (old) =>
        old
          ? { ...old, draft: data.draft, dirty: true }
          : { draft: data.draft, published: data.draft, dirty: true }
      );
    },
  });
}

export function usePublishSeo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      websiteApi<{ ok: boolean }>("/api/shop/admin/appearance/publish", {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SEO_APPEARANCE_KEY });
    },
  });
}

export function useSeoRedirects() {
  return useQuery({
    queryKey: SEO_REDIRECTS_KEY,
    queryFn: () =>
      websiteApi<{ items: SeoRedirectRow[] }>("/api/shop/admin/redirects"),
    staleTime: 10_000,
  });
}

export function useCreateRedirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fromPath: string; toPath: string; note?: string }) =>
      websiteApi<{ ok: boolean; item: SeoRedirectRow }>(
        "/api/shop/admin/redirects",
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SEO_REDIRECTS_KEY }),
  });
}

export function usePatchRedirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: {
      id: string;
      patch: Partial<{ toPath: string; fromPath: string; enabled: boolean; note: string }>;
    }) =>
      websiteApi<{ ok: boolean; item: SeoRedirectRow }>(
        `/api/shop/admin/redirects/${encodeURIComponent(opts.id)}`,
        { method: "PATCH", body: JSON.stringify(opts.patch) }
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SEO_REDIRECTS_KEY }),
  });
}

export function useDeleteRedirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      websiteApi<{ ok: boolean }>(
        `/api/shop/admin/redirects/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SEO_REDIRECTS_KEY }),
  });
}
