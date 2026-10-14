"use client";
import type { Dispatch, SetStateAction } from "react";
export function ProductQuantityPicker({ purchaseDisabled, qty, setQty, allowBackorder, liveTon }: {
  purchaseDisabled: boolean; qty: number; setQty: Dispatch<SetStateAction<number>>;
  allowBackorder?: boolean; liveTon: number;
}) {
  return (
                  <div className="flex flex-wrap items-center gap-4"><div className="text-sm font-semibold text-slate-800">Số lượng mua</div>
                  <div className="inline-flex items-center overflow-hidden rounded-lg border border-[#ddd]">
                    <button
                      type="button"
                      className="h-11 w-11 text-lg text-slate-600 hover:bg-[#f5f5f5] disabled:opacity-40"
                      disabled={purchaseDisabled || qty <= 1}
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={
                        purchaseDisabled || allowBackorder !== false
                          ? 10000
                          : Math.max(1, liveTon)
                      }
                      value={qty}
                      onChange={(e) => {
                        const n = Math.max(1, Number(e.target.value) || 1);
                        if (purchaseDisabled) {
                          setQty(1);
                          return;
                        }
                        if (allowBackorder !== false) {
                          setQty(Math.min(10000, Math.floor(n)));
                          return;
                        }
                        setQty(Math.min(n, Math.max(1, liveTon)));
                      }}
                      className="h-11 w-14 border-x border-[#ddd] bg-white text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      className="h-11 w-11 text-lg text-slate-600 hover:bg-[#f5f5f5] disabled:opacity-40"
                      disabled={
                        purchaseDisabled || qty >= 10000 || (allowBackorder === false && qty >= liveTon)
                      }
                      onClick={() =>
                        setQty((q) =>
                          allowBackorder !== false
                            ? Math.min(10000, q + 1)
                            : Math.min(Math.max(1, liveTon), q + 1)
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                  </div>
  );
}
