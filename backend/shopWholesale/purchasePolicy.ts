import { z } from "zod";
import type { Db } from "mongodb";
import type { ShopOrderDetail } from "../shopOrders/models.js";
import { isActiveWholesale } from "./policy.js";

export const purchasePolicySchema = z.object({
  hcmFirstMinimum: z.number().int().min(1).max(100000000),
  tinhMinimum: z.number().int().min(1).max(100000000),
  finishedQuantity: z.number().int().min(1).max(10000),
  cheapPotQuantity: z.number().int().min(1).max(10000),
  cheapPotPrice: z.number().int().min(1).max(100000000),
  rawQuantity: z.number().int().min(1).max(10000),
});
export const defaultPurchasePolicy = { hcmFirstMinimum: 2000000, tinhMinimum: 2000000,
  finishedQuantity: 5, cheapPotQuantity: 5, cheapPotPrice: 15000, rawQuantity: 10 };
export type PurchasePolicy = z.infer<typeof purchasePolicySchema> & { version: string };
export async function loadPurchasePolicy(db: Db): Promise<PurchasePolicy> {
  const doc = await db.collection("aloha_shop_purchase_policy").findOne({ key: "wholesale" });
  return { ...purchasePolicySchema.parse(doc?.rules || defaultPurchasePolicy), version: String(doc?.version || "2026-10-13.1") };
}
export const purchaseGroupSchema = z.enum(["finished", "pot", "raw", "other"]);
export function purchaseGroup(product: Record<string, any>): string | null {
  if (purchaseGroupSchema.safeParse(product.siPurchaseGroup).success) return product.siPurchaseGroup;
  const categories = [...(Array.isArray(product.ancestor) ? product.ancestor : []), product.categoryName]
    .map(v => String(v || "").normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase().trim());
  if (categories.some(v => /^cay thanh pham(?:\s|$)/.test(v))) return "finished";
  if (categories.includes("cay tho")) return "raw";
  if (categories.some(v => /^(chau|tieu canh)(\s|$)/.test(v))) return "pot";
  if (categories.includes("phu kien tieu canh")) return "pot";
  if (categories.includes("cay canh du loai")) return "raw";
  if (categories.some(v => ["dat da gia the dinh duong trong cay", "hat giong", "vat tu va thiet bi", "dia lot chau", "phu kien trang tri", "dung cu trong cay", "tui va hop de san pham", "binh tuoi cay"].includes(v))) return "other";
  return null;
}
export type PurchaseIssue = { code: string; message: string; productCode?: string; required?: number; quantity?: number };
export function evaluatePurchasePolicy(input: { account: any; lines: ShopOrderDetail[];
  products: Map<string, any>; policy: PurchasePolicy; history: "returning" | "new" | "unknown";
  delivery?: { deliveryMethod?: string; province?: string } }) {
  const { account, lines, products, policy, history, delivery } = input;
  const issues: PurchaseIssue[] = [];
  const goods = lines.filter(l => !l.isGift);
  const subtotal = goods.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const minimum = !isActiveWholesale(account) ? 0 : account.siRegion === "TINH" ? policy.tinhMinimum : history === "returning" ? 0 : policy.hcmFirstMinimum;
  if (!isActiveWholesale(account)) issues.push({ code: "account", message: "Tài khoản chưa có quyền mua sỉ đang hoạt động." });
  if (isActiveWholesale(account)) {
    if (!["HCM", "TINH"].includes(account.siRegion)) issues.push({ code: "region", message: "Tài khoản sỉ cần được xác nhận khu vực." });
    if (account.siRegion === "HCM" && history === "unknown" && subtotal < minimum) issues.push({ code: "history", message: "Chưa xác minh được lịch sử mua hàng. Liên hệ Aloha hoặc đặt đơn từ mức tối thiểu đơn đầu." });
    if (subtotal < minimum) issues.push({ code: "minimum", required: minimum, message: `${account.siRegion === "HCM" ? "Đơn đầu sỉ HCM" : "Đơn sỉ tỉnh"} cần thêm ${(minimum - subtotal).toLocaleString("vi-VN")}đ tiền hàng để đủ ${minimum.toLocaleString("vi-VN")}đ.` });
    const quantities = new Map<string, number>();
    for (const l of goods) quantities.set(l.productCode, (quantities.get(l.productCode) || 0) + l.quantity);
    for (const [code, quantity] of quantities) {
      const product = products.get(code);
      const group = product ? purchaseGroup(product) : null;
      const line = goods.find(l => l.productCode === code)!;
      if (!(line.price > 0) || line.priceKind === "si_missing") issues.push({ code: "price", productCode: code, message: `${code} chưa có giá sỉ — cần Aloha báo giá.` });
      if (account.siRegion !== "TINH") continue;
      if (!group) { issues.push({ code: "classification", productCode: code, message: `${code} cần Aloha xác nhận nhóm hàng mua sỉ.` }); continue; }
      const required = group === "finished" ? policy.finishedQuantity : group === "raw" ? policy.rawQuantity : group === "pot" && line.price < policy.cheapPotPrice ? policy.cheapPotQuantity : 1;
      if (quantity < required) issues.push({ code: "quantity", productCode: code, required, quantity,
        message: `${line.productName} (${code}): tối thiểu ${required} sản phẩm/mẫu, cần thêm ${required - quantity}.` });
    }
    if (account.siRegion === "HCM" && delivery?.deliveryMethod === "giao_tan_noi") {
      const province = String(delivery.province || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
      if (!/^(?:tp\.?\s*|thanh pho\s*)?ho chi minh$/.test(province.trim())) issues.push({ code: "delivery", message: "Khách sỉ HCM cần nhận tại cửa hàng hoặc địa chỉ tại TP.HCM; khách tự bố trí xe nhận hàng." });
    }
  }
  return { policyVersion: policy.version, subtotal, minimum, remaining: Math.max(0, minimum - subtotal),
    history, issues, canCheckout: issues.length === 0 };
}
