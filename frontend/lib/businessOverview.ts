export type Summary = { revenue: number; orders: number; average: number };
export type Funnel = { visits: number; cart: number; checkout: number; placed: number; trackingSince: string | null;
  transitions: { cart: number; checkout: number; placed: number } };
export type BusinessOverviewData = {
  sales: { summary: Summary; previous: Summary; points: { key: string; revenue: number; orders: number }[];
    previousFrom: string; previousTo: string; partialComparison: boolean; updatedAt: string };
  funnel: Funnel & { previous: Funnel };
};
export const numberText = (n: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(n);
export const moneyText = (n: number) => `${numberText(n)}đ`;
export const rate = (n: number, base: number) => base > 0 ? n / base * 100 : null;
export function changeText(current: number, previous: number) {
  if (previous <= 0) return { text: "Chưa có dữ liệu so sánh", direction: 0 };
  const change = (current - previous) / previous * 100;
  return { text: `${change > 0 ? "↑" : change < 0 ? "↓" : "="} ${numberText(Math.abs(change))}%`, direction: Math.sign(change) };
}
