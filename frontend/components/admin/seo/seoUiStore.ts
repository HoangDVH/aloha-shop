import { create } from "zustand";

export type SeoPanel = "hub" | "home" | "product" | "category" | "redirects";

type SeoUiState = {
  panel: SeoPanel;
  setPanel: (p: SeoPanel) => void;
  sampleProductMa: string;
  setSampleProductMa: (ma: string) => void;
  sampleCategoryName: string;
  setSampleCategoryName: (name: string) => void;
};

export const useSeoAdminUiStore = create<SeoUiState>((set) => ({
  panel: "hub",
  setPanel: (panel) => set({ panel }),
  sampleProductMa: "",
  setSampleProductMa: (sampleProductMa) => set({ sampleProductMa }),
  sampleCategoryName: "Chậu trồng cây",
  setSampleCategoryName: (sampleCategoryName) => set({ sampleCategoryName }),
}));
