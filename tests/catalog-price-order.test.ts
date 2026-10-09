import test from "node:test";
import assert from "node:assert/strict";
import { resolvePinBadgeScope } from "../backend/shopCatalog/pinArrange";
import { sortPublicItems } from "../backend/shopCatalog/catalog/publicProduct";
test("explicit price order overrides merchandising pins without removing the badge filter", () => {
 const items = [{ma:"pinned",ten:"Pinned",gia:85,webBadge:"moi",webPin:1},{ma:"cheap",ten:"Cheap",gia:45,webBadge:"moi"},{ma:"high",ten:"High",gia:1500,webBadge:"moi"}] as any;
 assert.equal(resolvePinBadgeScope({sort:"price_asc",badge:"moi"}),"");
 assert.equal(resolvePinBadgeScope({sort:"price_desc",badge:"moi"}),"");
 assert.equal(resolvePinBadgeScope({sort:"ban_chay",badge:"moi"}),"moi");
 assert.deepEqual(sortPublicItems(items,"price_asc",undefined,"moi").map(p=>p.ma),["cheap","pinned","high"]);
 assert.deepEqual(sortPublicItems(items,"price_desc",undefined,"moi").map(p=>p.ma),["high","pinned","cheap"]);
 assert.deepEqual(items.map((p:any)=>p.ma),["pinned","cheap","high"]);
});
