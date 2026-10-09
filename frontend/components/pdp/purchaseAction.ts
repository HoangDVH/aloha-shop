export function mobilePurchaseAction(state: {
  needPick: boolean; variantsLoading: boolean; purchaseDisabled: boolean; quantityExceedsStock: boolean;
}): "choose" | "buy" | "blocked" {
  if (state.needPick || state.variantsLoading || state.quantityExceedsStock) return "choose";
  return state.purchaseDisabled ? "blocked" : "buy";
}
