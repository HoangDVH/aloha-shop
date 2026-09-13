/**
 * Không hiện overlay logo toàn trang khi chuyển tab trong storefront.
 * Overlay đó + fetch SP force-dynamic làm nút Back từ checkout mất ~8s.
 * Trang SP có loading.tsx riêng (skeleton nhẹ).
 */
export default function StorefrontLoading() {
  return null;
}
