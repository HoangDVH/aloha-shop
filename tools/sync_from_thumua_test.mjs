/**
 * Script đồng bộ an toàn từ thumua_test -> aloha_shop_db
 * Giữ nguyên các trường merchandising/SEO/CTV đặc thù của Shop.
 */
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const SRC_DB_NAME = 'thumua_test';
const DEST_DB_NAME = 'aloha_shop_db';

const isApply = process.argv.includes('--apply');

async function run() {
  console.log(`\n==============================================`);
  console.log(`ĐỒNG BỘ: [${SRC_DB_NAME}] -> [${DEST_DB_NAME}]`);
  console.log(`Chế độ: ${isApply ? '🚀 APPLY (GHI THẬT)' : '🔍 DRY-RUN (CHỈ KIỂM TRA, KHÔNG GHI)'}`);
  console.log(`==============================================\n`);

  const client = new MongoClient(MONGO_URI);
  await client.connect();

  try {
    const srcDb = client.db(SRC_DB_NAME);
    const destDb = client.db(DEST_DB_NAME);

    // 1. Đồng bộ categories
    const srcCats = await srcDb.collection('categories').find({}).toArray();
    console.log(`[Categories] Nguồn có ${srcCats.length} danh mục.`);
    let catUpsertCount = 0;
    if (isApply) {
      for (const cat of srcCats) {
        const filter = cat.categoryId ? { categoryId: cat.categoryId } : { _id: cat._id };
        const { _id, ...docWithoutId } = cat;
        await destDb.collection('categories').updateOne(
          filter,
          { $set: docWithoutId },
          { upsert: true }
        );
        catUpsertCount++;
      }
      console.log(`[Categories] ✅ Đã cập nhật ${catUpsertCount} danh mục sang ${DEST_DB_NAME}.`);
    } else {
      console.log(`[Categories] Sẽ cập nhật ${srcCats.length} danh mục.`);
    }

    // 2. Backup aloha_products nếu là apply
    if (isApply) {
      const destCount = await destDb.collection('aloha_products').countDocuments();
      const backupColName = `aloha_products_backup_${Date.now()}`;
      console.log(`\n[Backup] Đang sao lưu ${destCount} sản phẩm sang collection [${backupColName}]...`);
      const allDest = await destDb.collection('aloha_products').find({}).toArray();
      if (allDest.length > 0) {
        await destDb.collection(backupColName).insertMany(allDest);
        console.log(`[Backup] ✅ Đã tạo bản sao lưu an toàn.`);
      }
    }

    // 3. Đồng bộ aloha_products
    const srcProducts = await srcDb.collection('aloha_products').find({}).toArray();
    const destProducts = await destDb.collection('aloha_products').find({}).toArray();
    const destMap = new Map(destProducts.map(p => [String(p.ma).trim().toUpperCase(), p]));

    let insertCount = 0;
    let updateCount = 0;
    const insertedMas = [];

    // Danh sách các trường CATALOG lấy từ thumua_test
    const CATALOG_FIELDS = [
      'ten', 'fullName', 'barcode', 'dvt', 'productType', 'type', 'loai',
      'giaWeb', 'giaBan', 'giaChung', 'giaTruocGiam', 'giaSi', 'giaVon',
      'categoryId', 'categoryName', 'ancestor', 'thuongHieu', 'viTri',
      'trongLuong', 'allowsSale', 'description', 'images', 'anh', 'videos',
      'attributes', 'hangThanhPhan', 'hasFormula', 'productFormulas', 'formulas',
      'updatedAt'
    ];

    for (const sp of srcProducts) {
      const ma = String(sp.ma).trim().toUpperCase();
      if (!ma) continue;

      const existing = destMap.get(ma);

      if (!existing) {
        // Sản phẩm mới chưa có trên shop -> Chèn mới
        insertCount++;
        insertedMas.push(ma);
        if (isApply) {
          const { _id, ...newDoc } = sp;
          // Thiết lập mặc định shop
          newDoc.ma = ma;
          newDoc.isActive = sp.isActive !== false;
          newDoc.hienThiWeb = true;
          await destDb.collection('aloha_products').insertOne(newDoc);
        }
      } else {
        // Đã có -> Cập nhật các trường catalog, bảo lưu trường đặc thù shop
        updateCount++;
        if (isApply) {
          const $set = {};
          for (const f of CATALOG_FIELDS) {
            if (sp[f] !== undefined) {
              $set[f] = sp[f];
            }
          }
          // Giữ nguyên ton từ destination nếu destination có tồn KiotViet mới hơn
          // nhưng nếu sp.ton > 0 và existing.ton === 0 thì có thể đồng bộ
          await destDb.collection('aloha_products').updateOne(
            { _id: existing._id },
            { $set }
          );
        }
      }
    }

    console.log(`\n[Products Summary]`);
    console.log(`- Tổng SP từ thumua_test: ${srcProducts.length}`);
    console.log(`- Số SP sẽ chèn mới vào shop: ${insertCount} (${insertedMas.join(', ') || 'không có'})`);
    console.log(`- Số SP sẽ cập nhật thông tin catalog: ${updateCount}`);
    console.log(`- Số SP riêng của shop được giữ nguyên: ${destProducts.length - (srcProducts.length - insertCount)}`);

    if (!isApply) {
      console.log(`\n⚠️ Đây là DRY-RUN (chưa có thay đổi nào được ghi vào DB).`);
      console.log(`Để áp dụng đồng bộ thật, hãy chạy: node tools/sync_from_thumua_test.mjs --apply\n`);
    } else {
      console.log(`\n🎉 ĐỒNG BỘ THÀNH CÔNG TỪ thumua_test QUA aloha_shop_db!`);
    }

  } finally {
    await client.close();
  }
}

run().catch(console.error);
