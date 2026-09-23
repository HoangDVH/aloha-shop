export function SiPriceBadge({ kind }: { kind?: string }) {
  if (kind !== "si" && kind !== "si_missing") return null;
  return <span className="inline-flex rounded-md bg-[var(--aloha-green-light)] px-2 py-1 text-[11px] font-bold text-[var(--aloha-green-dark)]">{kind === "si_missing" ? "Liên hệ báo giá" : "Giá sỉ"}</span>;
}
