import { PackageCheck } from "lucide-react";

export function BackorderNotice({ available, requested, unit = "cái", compact = false }: {
  available: number; requested: number; unit?: string; compact?: boolean;
}) {
  if (!Number.isFinite(available) || requested <= Math.max(0, available)) return null;
  const ready = Math.max(0, Math.floor(available));
  const out = ready === 0;
  return <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950" aria-live="polite">
    <div className="flex items-start gap-2"><PackageCheck size={21} className="mt-0.5 shrink-0" />
      <h3 className="font-bold">{out ? "SẢN PHẨM TẠM HẾT HÀNG" : "SẢN PHẨM CÒN SỐ LƯỢNG ÍT"} – ALOHA HỖ TRỢ ĐẶT TRƯỚC!</h3></div>
    <p className="mt-2 font-semibold">Hiện có {ready} {unit} · Bạn đặt {requested} {unit} · Cần bổ sung {requested - ready} {unit}</p>
    {!compact && <div className="mt-3 space-y-2">
      <p>Cảm ơn bạn đã quan tâm đến sản phẩm của Aloha!</p>
      <p>{out ? "Sản phẩm hiện đang tạm hết hàng." : "Sản phẩm còn số lượng ít."} Aloha sẽ nhanh chóng kiểm tra tình trạng hàng và liên hệ xác nhận với bạn.</p>
      <p>Sau khi đơn hàng được xác nhận, Aloha sẽ hướng dẫn bạn thanh toán trước hoặc đặt cọc để hoàn tất đặt hàng và sắp xếp vận chuyển.</p>
      <p className="font-semibold">Đặt hàng ngay hôm nay để Aloha hỗ trợ bạn sớm nhất nhé!</p>
    </div>}
  </aside>;
}
