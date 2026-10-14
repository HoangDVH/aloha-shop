import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { pdpApplicableVouchers, pdpDefaultVouchers } from "../frontend/lib/pdpVouchers.js";
test("PDP voucher badge claims the exact voucher; automatic promotions open details instead", () => {
  for (const [claimRequired, saved] of [[true, false], [true, true], [false, false]]) {
    const voucher = { id: "V5", targetCustomer: "new_web", scope: "all", discountType: "percentage", discountValue: 5, claimRequired, audienceEligible: true };
    let index = 0; const claimed: string[] = [], selected: any[] = [];
    const exports: any = {};
    const jsx = (type: any, props: any) => ({ type, props });
    const source = ts.transpileModule(readFileSync("frontend/components/pdp/ProductPromotionBadges.tsx", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(source, { exports, require(name: string) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react") return { useEffect() {}, useMemo: (fn: any) => fn(), useState() {
        const i = index++; return [i === 0 ? [voucher] : i === 1 ? true : null, (v: any) => selected.push(v)];
      } };
      if (name === "lucide-react") return {};
      if (name === "@/lib/promotions") return {};
      if (name === "@/lib/api") return { formatVnd: String };
      if (name === "@/lib/voucherFormat") return { pctText: () => "5%", formatCompactVnd: String, formatVoucherBadge: () => ({ label: "5%", type: "goods" }) };
      if (name === "@/lib/campaign/useVoucherClaims") return { useVoucherClaims: () => ({
        claim: (id: string) => claimed.push(id), claimedIds: new Set(saved ? ["V5"] : []), pendingId: null,
      }) };
      if (name === "@/components/campaign/LoginSheet") return { LoginSheet: "login" };
      if (name === "./PdpVoucherSheet") return { PdpVoucherSheet: "voucher-sheet" };
      if (name === "@/components/Toast") return { useToast: () => ({ push() {} }) };
      if (name === "@/components/ShopAuthProvider") return { useShopAuth: () => ({ user: null }) };
      if (name === "@/lib/campaign/useCampaignView") return { useCampaignView: () => ({ viewer: { newBuyer: true } }) };
      if (name === "@/lib/pdpVouchers") return { pdpApplicableVouchers, pdpDefaultVouchers };
      throw new Error(name);
    } });
    function nodes(n: any): any[] { return !n || typeof n !== "object" ? [] : [n, ...[n.props?.children].flat(5).flatMap(nodes)]; }
    const tree = exports.ProductPromotionBadges({ product: { ma: "P" } });
    const button = nodes(tree).find(n => n.type === "button" && n.props.title);
    button.props.onClick();
    assert.deepEqual(claimed, claimRequired && !saved ? ["V5"] : []);
    assert.deepEqual(selected, claimRequired && !saved ? [] : [voucher]);
  }
});
