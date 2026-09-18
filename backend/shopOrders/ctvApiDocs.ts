/**
 * Swagger UI cho API CTV / HH (scope plan).
 * Bật khi SHOP_API_DOCS=1 hoặc không phải production VPS.
 * Lazy-load swagger/yaml — thiếu package không làm chết API.
 */
import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import {
  requireAuth,
  requireActive,
  requireManager,
  type GetDb,
} from "../auth/middleware.js";

function docsEnabled(): boolean {
  if (String(process.env.SHOP_API_DOCS || "").trim() === "1") return true;
  if (String(process.env.SHOP_API_DOCS || "").trim() === "0") return false;
  return String(process.env.ALOHA_IS_VPS || "") !== "1";
}

function loadSpec(): Record<string, unknown> {
  const p = path.resolve(process.cwd(), "docs/api/openapi-ctv.yaml");
  if (!fs.existsSync(p)) {
    return {
      openapi: "3.0.3",
      info: {
        title: "ALOHA Shop CTV API",
        version: "1.0.0",
        description: "Thiếu file docs/api/openapi-ctv.yaml",
      },
      paths: {},
    };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const YAML = require("yaml") as { parse: (s: string) => unknown };
    return YAML.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return {
      openapi: "3.0.3",
      info: {
        title: "ALOHA Shop CTV API",
        version: "1.0.0",
        description: "Thiếu package yaml — không parse được OpenAPI",
      },
      paths: {},
    };
  }
}

export function registerShopCtvApiDocs(app: Express, getOpsDb: GetDb) {
  if (!docsEnabled()) {
    console.log("[api-docs] Tắt (SHOP_API_DOCS=0 hoặc VPS)");
    return;
  }

  let swaggerUi: typeof import("swagger-ui-express");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    swaggerUi = require("swagger-ui-express");
  } catch (e: any) {
    console.warn(
      "[api-docs] Bỏ qua — thiếu swagger-ui-express:",
      e?.message || e
    );
    return;
  }

  const spec = loadSpec();
  const gate = [requireAuth(getOpsDb), requireActive, requireManager];

  app.get("/api/shop/docs/openapi.json", ...gate, (_req: Request, res: Response) => {
    res.json(spec);
  });

  app.use("/api/shop/docs", ...gate, swaggerUi.serve, swaggerUi.setup(spec, {
    customSiteTitle: "ALOHA CTV API Docs",
  }));

  console.log("[api-docs] Swagger CTV: /api/shop/docs (manager)");
}
