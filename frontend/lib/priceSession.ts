import { create } from "zustand";
let generation = 0;
export const usePriceSession = create<{ ready: boolean; error: string }>(() => ({ ready: false, error: "" }));
export const priceSessionGeneration = () => generation;
export function advancePriceSession() { generation += 1; usePriceSession.setState({ ready: false, error: "" }); }
