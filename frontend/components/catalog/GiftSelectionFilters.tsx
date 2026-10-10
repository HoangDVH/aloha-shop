import type { DraftState } from "./draft";
import { GIFT_FIELDS } from "./giftProductSelection";

export function GiftSelectionFilters({ attributes, draft, onChange }: {
  attributes: Record<string, string[]>; draft: DraftState | null; onChange: (draft: DraftState) => void;
}) {
  if (!draft) return null;
  return <div className="mb-5 space-y-5 rounded-xl bg-emerald-50/50 p-4">
    <p className="text-sm text-stone-600">Chọn nơi đặt và loại cây bạn thích.</p>
    {GIFT_FIELDS.filter(field => field !== "Kiểu quà").map(field => attributes[field]?.length ? <section key={field}>
      <h3 className="mb-2 text-sm font-bold">{field}</h3>
      <div className="flex flex-wrap gap-2">{attributes[field].map(value => {
        const token = `${field}:${value}`;
        const active = draft.attrs.includes(token);
        return <button key={value} type="button" aria-pressed={active} className={`min-h-11 rounded-lg border px-3 text-sm ${active ? "border-emerald-700 bg-emerald-100 text-emerald-800" : "border-stone-200 bg-white text-stone-700"}`} onClick={() => onChange({ ...draft, attrs: active ? draft.attrs.filter(a => a !== token) : [...draft.attrs, token] })}>{value}</button>;
      })}</div>
    </section> : null)}
  </div>;
}
