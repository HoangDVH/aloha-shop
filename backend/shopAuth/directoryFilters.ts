/** Customer category and affiliate membership are independent dimensions. */
export function directoryFilter(query: Record<string, unknown>): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [{ roles: { $in: ["customer", "si", "ctv"] } }];
  const type = String(query.customerType || "all");
  if (type === "retail") clauses.push({ roles: { $ne: "si" } });
  else if (type === "HCM" || type === "TINH") clauses.push({ roles: "si", siRegion: type });
  else if (type === "unassigned") clauses.push({ roles: "si", siRegion: { $nin: ["HCM", "TINH"] } });
  else if (type === "wholesale") clauses.push({ roles: "si" });
  else if (type !== "all") throw new Error("Loại khách không hợp lệ");

  const ctv = String(query.affiliate || "all");
  if (ctv === "none") clauses.push({ roles: { $ne: "ctv" } });
  else if (ctv === "member") clauses.push({ roles: "ctv" });
  else if (["cho_duyet", "active", "khoa", "tu_choi"].includes(ctv)) clauses.push({ roles: "ctv", ctvStatus: ctv });
  else if (ctv !== "all") throw new Error("Trạng thái CTV không hợp lệ");

  const si = String(query.wholesaleStatus || "all");
  if (["cho_duyet", "active", "khoa", "tu_choi"].includes(si)) clauses.push({ roles: "si", siStatus: si });
  else if (si !== "all") throw new Error("Trạng thái sỉ không hợp lệ");

  const state = String(query.accountState || "all");
  if (state === "locked") clauses.push({ active: false });
  else if (state === "active") clauses.push({ active: { $ne: false } });
  else if (state !== "all") throw new Error("Trạng thái tài khoản không hợp lệ");

  if (query.pending === "1") clauses.push({ $or: [
    { roles: "si", siStatus: "cho_duyet" }, { roles: "ctv", ctvStatus: "cho_duyet" },
  ] });
  return { $and: clauses };
}
