/** An older accounts API silently ignores the directory's filter parameters. */
export function requireDirectoryResponse<T extends { items: unknown[]; total: number; directoryVersion?: number }>(data: T): T {
  if (data.directoryVersion !== 1) {
    throw new Error("Máy chủ chưa cập nhật bộ lọc khách hàng. Cần cập nhật hoặc khởi động lại dịch vụ API trước khi sử dụng danh sách này.");
  }
  return data;
}
