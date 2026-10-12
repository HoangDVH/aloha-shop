export type TopPeriod = "today" | "yesterday" | "week" | "month" | "previousMonth" | "30days" | "custom";
const day = (date: Date) => date.toISOString().slice(0, 10);
export function topChartRange(period: TopPeriod, now = new Date()) {
  const vn = new Date(now.getTime() + 7 * 3600_000), y = vn.getUTCFullYear(), m = vn.getUTCMonth();
  const today = new Date(Date.UTC(y, m, vn.getUTCDate()));
  if (period === "previousMonth") return { from: day(new Date(Date.UTC(y, m - 1, 1))), to: day(new Date(Date.UTC(y, m, 0))) };
  if (period === "yesterday") { const date = day(new Date(today.getTime() - 86400_000)); return { from: date, to: date }; }
  const days = period === "week" ? 7 : period === "30days" ? 30 : 1;
  return { from: period === "month" || period === "custom" ? day(new Date(Date.UTC(y, m, 1))) : day(new Date(today.getTime() - (days - 1) * 86400_000)), to: day(today) };
}
export function chartAxis(max: number, integer: boolean) {
  if (!(max > 0)) return { max: 5, ticks: [0, 1, 2, 3, 4, 5] };
  const target = max * 1.15 / 6, magnitude = 10 ** Math.floor(Math.log10(target));
  let step = ([1, 2, 2.5, 4, 5, 10].find(n => n * magnitude >= target) || 10) * magnitude;
  if (integer) step = Math.max(1, Math.ceil(step));
  const count = Math.ceil(max * 1.15 / step);
  return { max: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
}
export function chartNumber(value: number, money: boolean) {
  const format = (n: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(n);
  if (money && Math.abs(value) >= 1_000_000_000) return `${format(value / 1_000_000_000)} tỷ`;
  if (money && Math.abs(value) >= 1_000_000) return `${format(value / 1_000_000)} tr`;
  if (money && Math.abs(value) >= 1_000) return `${format(value / 1_000)} nghìn`;
  return format(value);
}
