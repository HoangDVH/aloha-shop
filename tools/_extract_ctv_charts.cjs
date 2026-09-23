"use strict";
const fs = require("fs");
const lines = fs
  .readFileSync("frontend/components/admin/ctv/CtvAdminShell.tsx", "utf8")
  .split(/\r?\n/);
const helpers = lines.slice(157, 213).join("\n");
const spark = lines
  .slice(218, 476)
  .join("\n")
  .replace("function DailySpark", "export function DailySpark");
const conv = lines
  .slice(478, 593)
  .join("\n")
  .replace("function ConversionCard", "export function ConversionCard");

fs.writeFileSync(
  "frontend/components/ctv-portal/charts/DailySpark.tsx",
  `"use client";

import { useMemo, useState } from "react";
import { Empty } from "antd";
import { formatVnd } from "../shared/format";

${helpers}

${spark}
`
);

fs.writeFileSync(
  "frontend/components/ctv-portal/charts/ConversionCard.tsx",
  `"use client";

import { Empty } from "antd";

${conv}
`
);
console.log("ok");
