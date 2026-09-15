const { generateKiotVietPaymentQr, getPrivatePaymentToken } = require('./index');

async function runTest() {
  console.log('====================================================');
  console.log('🚀 KIỂM TRA MODULE TỰ ĐỘNG TẠO MÃ QR THANH TOÁN KIOTVIET');
  console.log('====================================================\n');

  try {
    console.log('1. Đang kiểm tra token...');
    const token = await getPrivatePaymentToken();
    console.log('✅ Token hợp lệ:', token.slice(0, 35) + '...\n');

    console.log('2. Đang gọi API tạo mã QR cho hóa đơn HD022010 (2,090 đ)...');
    const result = await generateKiotVietPaymentQr({
      amount: 2090,
      content: 'bill HD022010',
    });

    console.log('\n🎉 THÀNH CÔNG RỰC RỠ!');
    console.log('----------------------------------------------------');
    console.log('🔹 Mã nhận diện tự động (KOV Code):', result.body.kov_code);
    console.log('🔹 Chuỗi VietQR (EMVCo):', result.body.qr_string);
    console.log('🔹 Transaction ID:', result.body.transaction_id);
    console.log('🔹 Ảnh QR (Base64):', result.body.image ? result.body.image.slice(0, 60) + '...' : 'none');
    console.log('----------------------------------------------------');
    console.log('👉 Khách hàng quét mã này thanh toán thì KiotViet sẽ tự động khớp và gạch nợ hóa đơn!');
  } catch (err) {
    console.error('\n❌ LỖI:', err.message);
  }
}

runTest();
