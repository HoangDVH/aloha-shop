"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
type Draft = { phone?: string; province?: string; district?: string; ward?: string; detail?: string; fullName?: string; shopName?: string; businessType?: string; taxCode?: string; note?: string };
export const useSiDraft = create<{ draft: Draft; savedAt: number; owner: string; save: (draft: Draft, owner: string) => void; clear: () => void }>()(
  persist(set => ({ draft: {}, savedAt: 0, owner: "", save: (draft, owner) => set({ draft, owner, savedAt: Date.now() }),
    clear: () => set({ draft: {}, savedAt: 0, owner: "" }) }), { name: "aloha-si-draft-v1", partialize: s => ({ draft: s.draft, owner: s.owner, savedAt: s.savedAt }) })
);
