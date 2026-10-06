# Kế hoạch phần "Độ tin cậy" trên trang chủ shop Aloha

Ngày lập: 06/10/2026. Trạng thái: đề xuất, chưa triển khai code.

Đã chốt với người yêu cầu:
- Vị trí: sau các khối sản phẩm, trước khối "Thông tin hữu ích".
- Phạm vi: làm cả giai đoạn 1 (khối hiển thị + bật/tắt) và giai đoạn 2 (admin tự sửa nội dung).

## 1. Mục tiêu

Khách mới vào trang chủ thấy được bằng chứng thật rằng Aloha đã làm cho doanh nghiệp, tổ chức; có dịch vụ quà tặng; có cửa hàng thật; có khách thật; có mặt trên các sàn thương mại điện tử.

Khối gồm 4 phần, phần nào không có dữ liệu thì tự ẩn:

1. **Đơn hàng đã thực hiện** (doanh nghiệp, tổ chức).
2. **Dịch vụ** (in logo, gói quà, đơn số lượng lớn).
3. **Cửa hàng và khách hàng thực tế**.
4. **Có mặt trên các sàn** (Shopee, Lazada, TikTok Shop…).

Cuối khối có nút "Nhận báo giá quà tặng doanh nghiệp" mở Zalo của shop.

Không bịa số liệu: không ghi số lượng đơn, số khách, điểm đánh giá nếu chưa có số thật.

## 2. Phân tích bộ ảnh nguồn

Thư mục nguồn: `Downloads/anh aloha`, 19 file, 16 ảnh khác nhau (3 file đuôi "(1)" trùng nội dung).

| Ảnh | Nội dung | Dùng cho |
|---|---|---|
| 593cdbdb | Chậu dán tem BIDV Chi nhánh Đông Sài Gòn "Luôn bên bạn" | Đơn hàng đã thực hiện |
| 563b2c95 | Chậu + túi quà in logo Phan Vũ "Phát triển bền vững" | Đơn hàng đã thực hiện |
| 1014eca1 | Chậu kỷ niệm 75 năm Ngày truyền thống HSSV, Tỉnh Đoàn – Hội Sinh viên Bình Dương | Đơn hàng đã thực hiện |
| 4bd48696 | Chậu vuông logo "HG", ghi Tỉnh Đoàn Tây Ninh – Hội LHTN Việt Nam | Đơn hàng đã thực hiện (chờ xác nhận) |
| acfb35e9 | Chậu sen đá logo "HG", ghi "HOANG GIA" | Đơn hàng đã thực hiện (chờ xác nhận) |
| e039c713 | Hàng chậu tròn in logo Eco Retreat | Đơn hàng đã thực hiện |
| 7de88084 | Tay cầm túi quà Phan Vũ, nền nhiều túi | Dịch vụ: in logo chậu và túi |
| 027e0bd1 | Bộ quà trọn gói: túi, thẻ hướng dẫn chăm sóc cây kim tiền, túi sỏi, danh thiếp Aloha | Dịch vụ: gói quà trọn bộ |
| e376a117 | Cả bàn túi quà Phan Vũ | Dịch vụ: đơn số lượng lớn |
| 7d7388d1 | Cây trong túi xếp vào thùng carton | Dịch vụ: đóng thùng giao (ảnh dự phòng) |
| 61f1e6d2, bacb2395, 80a619a1, 6d034d9a, 1d51665b | Kệ cây trong cửa hàng, nhãn giá có QR | Cửa hàng thực tế |
| 0ea167fb, c2b588e1 | Các bé học sinh cầm cây tại shop | Khách hàng thực tế (chờ phụ huynh đồng ý) |
| bb0af1a5, 4b06c491 | Ảnh camera quầy thu ngân, lộ mặt khách + mốc giờ | **Không dùng** |

Chưa có ảnh nào cho phần sàn thương mại điện tử.

## 3. Việc cần chuẩn bị trước (phía shop)

1. Xác nhận logo "HG" là của Tỉnh Đoàn Tây Ninh hay Hoàng Gia; ảnh nào là ảnh gốc của đơn thật. Một số ảnh có dấu hiệu đã chỉnh sửa (chữ trên thẻ méo, "Tamorow"/"Tomarow"). Phần độ tin cậy mà dùng ảnh sai thì phản tác dụng.
2. Xin phép hiển thị tên và ảnh đơn hàng của từng đơn vị. Chú ý BIDV (logo ngân hàng) và logo Đoàn, Hội.
3. Nếu muốn dải logo: xin file logo gốc (PNG nền trong hoặc SVG) của đơn vị đã đồng ý.
4. Xin phụ huynh đồng ý cho đăng ảnh các bé.
5. Gửi link gian hàng trên các sàn (nếu có) kèm điểm đánh giá, lượt bán thật.

Mục nào chưa xác nhận thì vẫn triển khai được, chỉ cần để mục đó ở trạng thái ẩn.

Câu chữ: tiêu đề phần 1 dùng **"Đơn hàng đã thực hiện"**. Chỉ đổi thành "Đối tác" / "Đã đồng hành cùng" khi đã có thỏa thuận cho dùng tên, logo.

## 4. Hiện trạng đã kiểm tra trong source

| Thành phần | Vai trò / lưu ý |
|---|---|
| frontend/app/(storefront)/page.tsx | Trang chủ, gọi `renderTopBlocks` rồi `renderHomeMainSections` |
| frontend/components/blocks/HomeBlockRenderer.tsx | `renderHomeMainSections` (dòng ~411) chỉ xử lý `product_section` và `article_section`; tự chèn khối mặc định nếu cấu hình cũ thiếu |
| frontend/components/HomeTrustBar.tsx | Thanh 5 cam kết dưới banner (khối `feature_strip`), nội dung cố định. Giữ nguyên, không gộp |
| frontend/components/about/VeAlohaLanding.tsx, CustomerReviews.tsx | Trang /ve-aloha có thẻ dịch vụ và đánh giá khách; tham khảo kiểu thẻ |
| backend/shopAppearance/types.ts | `AppearanceBlockType` liệt kê loại khối; khối có `props: Record<string, unknown>` |
| backend/shopAppearance/seed.ts | Danh sách khối mặc định |
| backend/shopAppearance/register.ts | Lưu `blocks` **nguyên trạng, không kiểm tra props** (dòng ~115, ~344). Có đoạn tự bổ sung khối `article_section` khi thiếu (dòng ~147–165) |
| backend/shopAppearance/register.ts (dòng ~530–582) | API `/api/shop/admin/appearance/upload` đổi ảnh sang WebP bằng sharp, lưu `/uploads/shop-appearance/` |
| frontend/lib/appearance.ts | Kiểu dữ liệu + cấu hình mặc định phía frontend, `fetchAppearance` |
| frontend/components/admin/website/appearance/BlockList.tsx, panels/HomePanel.tsx, editorUtils.ts | Admin "Giao diện → Trang chủ": nhãn khối, bật/tắt, sắp xếp |
| frontend/components/admin/website/appearance/ImageUploadField.tsx | Ô tải ảnh dùng lại được |
| frontend/components/SiteChrome.tsx (SiteFooter) | Có địa chỉ, Zalo, email; chưa có link sàn |

Styling: Tailwind + biến màu `--aloha-*`, ảnh dùng thẻ `<img>` với đường dẫn public.

## 5. Thiết kế dữ liệu

Khối mới `type: "trust_section"` trong `blocks`, nội dung nằm trong `props`:

```ts
type TrustSectionProps = {
  title?: string;                 // mặc định "Khách hàng tin chọn Aloha"
  clientsTitle?: string;          // mặc định "Đơn hàng đã thực hiện"
  clients: TrustItem[];           // đơn hàng doanh nghiệp/tổ chức
  services: TrustItem[];          // 3 thẻ dịch vụ
  gallery: TrustItem[];           // ảnh cửa hàng + khách
  marketplaces: TrustMarketplace[];
  cta?: { label: string; href: string };
};

type TrustItem = {
  id: string;
  enabled: boolean;
  imageUrl: string;               // "/banners/trust/..." hoặc "/uploads/shop-appearance/..."
  logoUrl?: string;               // chỉ khi có logo gốc và đã được phép
  title: string;                  // tên đơn vị / tên dịch vụ
  caption?: string;               // mô tả ngắn
  kind?: "store" | "customer";    // chỉ cho gallery
};

type TrustMarketplace = {
  id: string;
  enabled: boolean;
  platform: "shopee" | "lazada" | "tiktok" | "khac";
  label: string;
  url: string;                    // bắt buộc https
  note?: string;                  // ví dụ "4.9★ – 1.2k đã bán" (chỉ số thật)
};
```

Quy tắc hiển thị: mục `enabled: false` không hiện; phần nào rỗng thì ẩn cả phần; cả khối rỗng thì không render.

## 6. Giai đoạn 1: khối hiển thị + bật/tắt

### 6.1. Ảnh
- Chuyển ảnh ở mục 2 sang WebP, cạnh dài tối đa 1200px, chất lượng ~82, bằng sharp.
- Lưu vào `frontend/public/banners/trust/`, đặt tên dễ hiểu (vd. `don-bidv.webp`, `dich-vu-goi-qua.webp`, `cua-hang-1.webp`).
- Không đưa lên: 2 ảnh camera, 3 file trùng.

### 6.2. Backend
- Thêm `"trust_section"` vào `AppearanceBlockType` (backend/shopAppearance/types.ts).
- Thêm khối `trust_section` vào seed, đặt ngay trước `article_section`, props mặc định lấy từ mục 6.3.
- Viết `normalizeTrustProps` (file mới backend/shopAppearance/trust.ts) và gọi khi lưu draft:
  - Giới hạn số mục (clients ≤ 12, services ≤ 6, gallery ≤ 16, marketplaces ≤ 6) và độ dài chữ.
  - `imageUrl`/`logoUrl` chỉ nhận đường dẫn bắt đầu bằng `/banners/` hoặc `/uploads/shop-appearance/`.
  - `marketplaces[].url` chỉ nhận `https://`; `cta.href` nhận `https://`, `/…` hoặc link Zalo. Chặn `javascript:` và các giao thức khác.
  - Bỏ mục thiếu ảnh hoặc thiếu tiêu đề.
- Lý do: hiện register.ts lưu blocks nguyên trạng; khối này có link do admin nhập nên phải kiểm tra phía server.

### 6.3. Frontend
- `frontend/lib/trustShowcase.ts`: kiểu dữ liệu + nội dung mặc định (dùng khi cấu hình chưa có props) + hàm lọc mục hiển thị.
- `frontend/components/HomeTrustShowcase.tsx`:
  - Tiêu đề khối, 4 phần theo mục 1, nút báo giá Zalo.
  - Điện thoại: thẻ vuốt ngang; máy tính: lưới 3 cột (gallery 4 cột).
  - Ảnh `loading="lazy"`, khai báo width/height, chú thích tiếng Việt.
  - Bấm ảnh mở xem lớn (component client nhỏ, đóng bằng Esc / bấm nền; gỡ listener khi đóng).
  - Link sàn mở tab mới với `rel="noopener noreferrer"`.
- `HomeBlockRenderer.tsx`:
  - `renderHomeMainSections` nhận thêm `trust_section`, render `HomeTrustShowcase`.
  - Cấu hình cũ chưa có khối này: tự chèn ngay trước khối "Thông tin hữu ích" (giống cách đang chèn khối mặc định).
- `frontend/lib/appearance.ts`: thêm loại khối vào kiểu và cấu hình mặc định.

### 6.4. Admin (bật/tắt)
- `BlockList.tsx`: nhãn "Độ tin cậy / Khách hàng", icon phù hợp.
- `HomePanel.tsx`: nút bật/tắt và kéo thả thứ tự như các khối khác.

## 7. Giai đoạn 2: admin tự sửa nội dung

Trong "Giao diện → Trang chủ", bấm vào khối "Độ tin cậy / Khách hàng" mở form (file mới `frontend/components/admin/website/appearance/TrustSectionForm.tsx`):

- 4 tab: Đơn hàng, Dịch vụ, Ảnh cửa hàng & khách, Sàn TMĐT; thêm ô sửa tiêu đề khối và nút báo giá.
- Mỗi mục: tải ảnh (dùng lại `ImageUploadField`, ảnh tự đổi WebP), logo (tùy chọn), tiêu đề, mô tả, công tắc hiện/ẩn, nút lên/xuống, xóa.
- Mục sàn: chọn nền tảng, nhập link https, ghi chú số liệu thật.
- Lưu vào draft như các khối khác; chỉ lên web khi bấm "Xuất bản" (giữ nguyên quy trình draft/publish/khôi phục bản trước).
- Hiện cảnh báo nhỏ trong form: "Chỉ đăng tên/logo đơn vị đã đồng ý; ảnh trẻ em cần phụ huynh đồng ý."
- Kiểm tra phía client chỉ để báo lỗi sớm; quyết định cuối vẫn ở `normalizeTrustProps` phía server.

## 8. Kiểm thử

- Test mới `tests/shop-trust-section.test.ts`:
  - `normalizeTrustProps` bỏ link `javascript:`, link http thường, đường dẫn ảnh ngoài thư mục cho phép, mục thiếu tiêu đề; cắt danh sách quá dài.
  - Cấu hình thiếu khối `trust_section` vẫn được chèn trước `article_section`.
- `npx tsc -p tsconfig.backend.json --noEmit` (gốc) và `npx tsc -p tsconfig.json --noEmit` (trong `frontend/`).
- `npm test`.
- Xem trên localhost:3002: chụp bản máy tính và điện thoại; thử bật/tắt khối, sửa một mục, lưu draft, xuất bản trên môi trường local.
- Không ghi dữ liệu thử vào DB production; không chạy `next build` khi dev server đang chạy.

## 9. Ngoài phạm vi

- Không gộp/sửa `HomeTrustBar` (thanh 5 cam kết dưới banner).
- Không nhúng Google Maps, không tự lấy số liệu từ API các sàn.
- Không deploy, không commit cho tới khi được yêu cầu.

## 10. Thứ tự triển khai

1. Chuyển ảnh sang WebP (mục 6.1).
2. Backend: loại khối, seed, `normalizeTrustProps` + test.
3. Frontend: dữ liệu mặc định, `HomeTrustShowcase`, renderer.
4. Admin: nhãn, bật/tắt.
5. Admin: form sửa nội dung (giai đoạn 2).
6. Typecheck, test, xem localhost, gửi ảnh chụp để duyệt.
