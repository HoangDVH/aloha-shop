const { createPromotionForProduct, getProductByCode } = require('./index');

async function main() {
  console.log('====================================================');
  console.log('🚀 DEMO TẠO CHƯƠNG TRÌNH KHUYẾN MÃI CHO 1 SẢN PHẨM');
  console.log('====================================================\n');

  // Ví dụ truyền mã sản phẩm cần tạo khuyến mại
  const productCode = process.argv[2] || 'TNM2L';

  try {
    console.log(`📌 Bắt đầu tạo khuyến mãi cho mã: "${productCode}"...`);
    
    // Gọi hàm tạo khuyến mãi
    // Tự động đặt tên: "KM cây thành phẩm {productCode}"
    // Tự động cấu hình: Mua >=1 giảm 20%, Mua >=10 giảm 30%
    const res = await createPromotionForProduct({
      productCode: productCode,
      // Có thể truyền thêm các tham số nếu cần tùy biến:
      // campaignName: `KM cây thành phẩm ${productCode}`,
      // discounts: [
      //   { minQuantity: 1, discountRatio: 20 },
      //   { minQuantity: 10, discountRatio: 30 }
      // ]
    });

    console.log('\n🎉 TẠO CHƯƠNG TRÌNH KHUYẾN MÃI THÀNH CÔNG!');
    console.log('----------------------------------------------------');
    console.log('🔹 Campaign ID  :', res.campaignId);
    console.log('🔹 Mã KM        :', res.campaignCode);
    console.log('🔹 Tên KM       :', res.campaignName);
    console.log('🔹 Mã Sản Phẩm  :', res.productCode);
    console.log('🔹 ID Sản Phẩm  :', res.productId);
    console.log('----------------------------------------------------');
    console.log('👉 Bạn có thể vào lại giao diện KiotViet để kiểm tra ngay!');
  } catch (err) {
    console.error('\n❌ LỖI:', err.message);
  }
}

main();
