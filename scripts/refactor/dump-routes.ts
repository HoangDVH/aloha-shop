import { registerShopApi } from "../../backend/shopCatalog/register.js";
import { registerShopCtvMeRoutes } from "../../backend/shopOrders/ctvMeRoutes.js";
import { registerShopArticlesRoutes } from "../../backend/shopArticles/register.js";
import { registerShopCommissionAdminRoutes } from "../../backend/shopOrders/commissionAdminRoutes.js";

const calls: string[] = [];
const METHODS = ["get", "post", "put", "patch", "delete", "use", "options", "all"];
const app: any = new Proxy({}, {
  get: (_t, prop: string) => (...args: unknown[]) => {
    if (!METHODS.includes(prop)) return;
    const p = args[0];
    const path = typeof p === "string" ? p : Array.isArray(p) ? p.join("|") : "(middleware)";
    calls.push(`${prop.toUpperCase().padEnd(7)} ${path}  [handlers=${args.length - 1}]`);
  },
});
const noDb: any = async () => { throw new Error("no db in route dump"); };

registerShopApi(app, noDb, noDb, noDb);
registerShopCtvMeRoutes(app, noDb, noDb);
registerShopArticlesRoutes(app, noDb, noDb);
registerShopCommissionAdminRoutes(app, noDb, noDb);

console.log(calls.join("\n"));
