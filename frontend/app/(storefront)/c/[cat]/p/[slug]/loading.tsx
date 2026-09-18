export default function ProductDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square rounded-xl bg-[#EDE6D8]" />
        <div className="space-y-4">
          <div className="h-4 w-24 rounded bg-[#EDE6D8]" />
          <div className="h-8 w-4/5 rounded bg-[#EDE6D8]" />
          <div className="h-7 w-32 rounded bg-[var(--aloha-line)]" />
          <div className="h-20 w-full rounded-xl bg-[var(--aloha-cream)]" />
          <div className="h-11 w-48 rounded-lg bg-[var(--aloha-green)]/25" />
        </div>
      </div>
    </div>
  );
}
