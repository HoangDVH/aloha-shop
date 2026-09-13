export default function NotFound() {
  return (
    <div className="rounded-2xl bg-white px-4 py-16 text-center ring-1 ring-[#06231C]/08">
      <h1 className="text-xl font-extrabold text-[#06231C]">Không tìm thấy sản phẩm</h1>
      <p className="mt-2 text-sm text-[#06231C]/65">Link có thể cũ hoặc hàng đã ngừng bán.</p>
      <a href="/tim" className="mt-4 inline-block text-sm font-bold text-[#06231C] underline">
        Quay lại tìm hàng
      </a>
    </div>
  );
}
