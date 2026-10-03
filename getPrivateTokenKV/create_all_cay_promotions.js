const { getProductsByCategoryIds, createPromotionForProduct } = require('./index');

// 10 danh mục con của "CÂY THÀNH PHẨM TRỒNG SẴN"
const CAY_CATEGORY_IDS = [
  1002351, 820172, 820175, 820179, 1002377, 820183, 686422, 1002349, 759572, 1002368
];

async function main() {
  console.log('====================================================');
  console.log('🌿 TỰ ĐỘNG TẠO KHUYẾN MÃI CHO 214 CÂY THÀNH PHẨM');
  console.log('====================================================\n');

  console.log('1. Đang tải danh sách 214 sản phẩm từ KiotViet...');
  const products = await getProductsByCategoryIds(CAY_CATEGORY_IDS);
  console.log(`✅ Đã tìm thấy chính xác ${products.length} sản phẩm!\n`);

  // Xem trước 5 sản phẩm đầu tiên
  console.log('📋 Danh sách mẫu:');
  products.slice(0, 5).forEach((p, idx) => {
    console.log(`  ${idx + 1}. [${p.productCode}] ${p.productName} (ID: ${p.productId})`);
  });
  console.log('  ...\n');

  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('🔍 Chế độ xem trước (--dry-run): Không gửi lệnh tạo lên KiotViet.');
    return;
  }

  console.log('2. Bắt đầu tạo chương trình khuyến mại...');
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      console.log(`[${i + 1}/${products.length}] Đang tạo KM cho: ${p.productCode} - ${p.productName}...`);
      
      const res = await createPromotionForProduct({
        productCode: p.productCode,
        productId: p.productId, // Truyền trực tiếp productId để không phải query lại
        productName: p.productName
      });

      console.log(`   ✅ Thành công: ${res.campaignCode} - ${res.campaignName}`);
      successCount++;

      // Delay nhẹ 200ms giữa các request
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`   ❌ Lỗi tại mã ${p.productCode}:`, err.message);
      failCount++;
    }
  }

  console.log('\n====================================================');
  console.log(`🎉 HOÀN THÀNH: Thành công ${successCount}/${products.length}, Thất bại: ${failCount}`);
  console.log('====================================================');
}

main();
