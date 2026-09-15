const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 1. Thử nạp .env nằm ngay trong thư mục này (khi đem sang project khác)
const localEnv = path.resolve(__dirname, '.env');
if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv, override: true });
}

// 2. Thử nạp .env ở thư mục cha (khi đang ở trong project ALOHA)
const parentEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(parentEnv)) {
  dotenv.config({ path: parentEnv, override: true });
}

module.exports = {
  retailer: process.env.KV_RETAILER || 'alohanguyen',
  username: process.env.KV_PRIVATE_USERNAME || '',
  password: process.env.KV_PRIVATE_PASSWORD || '',
  merchantId: process.env.KV_MERCHANT_ID || '906762',
  branchId: process.env.KV_BRANCH_ID || '24862',
  paymentId: process.env.KV_PAYMENT_ID || '9931101233',
  paymentCode: process.env.KV_PAYMENT_CODE || 'VCB',
  bankAccountId: process.env.KV_BANK_ACCOUNT_ID || '20069',
  manualToken: process.env.KV_PAYMENT_TOKEN || '',
};

