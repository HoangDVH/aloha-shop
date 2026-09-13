export type ShipSizeClass = "nho" | "vua" | "to" | "dat_giath";

export type SizePreset = {
  weightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export const SIZE_PRESETS: Record<ShipSizeClass, SizePreset> = {
  nho: { weightGram: 500, lengthCm: 15, widthCm: 15, heightCm: 20 },
  vua: { weightGram: 3000, lengthCm: 25, widthCm: 25, heightCm: 35 },
  to: { weightGram: 12000, lengthCm: 40, widthCm: 40, heightCm: 55 },
  dat_giath: { weightGram: 20000, lengthCm: 45, widthCm: 35, heightCm: 25 },
};

export const DEFAULT_SIZE_CLASS: ShipSizeClass = "nho";
export const DEFAULT_WEIGHT_GRAM = SIZE_PRESETS.nho.weightGram;
