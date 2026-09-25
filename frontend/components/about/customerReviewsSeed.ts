import type { CustomerReview } from "./CustomerReviews";

/** Preview content only. Never import into the production reviews database. */
export const CUSTOMER_REVIEWS_SEED: CustomerReview[] = [
  {
    id: "demo-mb-thong-nhat",
    name: "Ngân hàng TMCP Quân Đội",
    location: "CN Thống Nhất",
    rating: 5,
    image: "/banners/ve-aloha/danhgianganhang.jpg",
    content:
      "Rất hài lòng với chậu cây Kim Ngân tươi đẹp, dáng chuẩn và chậu sứ sang trọng cho sự kiện khai trương PGD Tân Sơn. Từ khâu tư vấn, chọn dáng cây cho đến khi giao hàng hoàn thiện đều rất chuyên nghiệp và nhanh chóng!",
  },
  {
    id: "demo-huong-nhi",
    name: "Hương Nhi",
    location: "Tân Bình, TP.HCM",
    rating: 5,
    image: "/banners/ve-aloha/danhgiacuanhi.jpg",
    content:
      "Mình mua 3 lần rồi, lần đầu tiên là tới cửa hàng mua. Lần sau đặt trên web và Zalo. Cây và chậu đều đẹp như hình, shop giao cẩn thận và tư vấn rất nhiệt tình.",
  },
  {
    id: "demo-manh-hai",
    name: "Mạnh Hải",
    location: "Bến Tre",
    rating: 5,
    image: "/banners/ve-aloha/danhgiaanhhai.jpg",
    content:
      "Chậu và cây cảnh rất đẹp, đúng như hình. Giá hợp lý, đóng gói rất cẩn thận, cây về vẫn tươi tốt. Mình rất thích trải nghiệm mua hàng tại Aloha.",
  },
  {
    id: "demo-anh-bi",
    name: "Anh Bi",
    rating: 5,
    image: "/banners/ve-aloha/danhgiacuaanhbi.jpg",
    content:
      "Đã ghé mua tại cửa hàng, dịch vụ tốt, chất lượng, cây đẹp và dễ chăm. Giá cả hợp lý, nhiều mẫu đẹp để lựa chọn. Mọi người có cần mua ghé shop nhé!",
  },
];
