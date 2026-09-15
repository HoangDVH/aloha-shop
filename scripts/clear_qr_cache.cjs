const { MongoClient } = require('mongodb');
(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('aloha_shop_db');
  const result = await db.collection('aloha_shop_orders').updateOne(
    { code: 'WEB-260915-BKUV' },
    { $unset: { kiotvietQr: '' } }
  );
  console.log('Cleared kiotvietQr cache:', result.modifiedCount);
  const order = await db.collection('aloha_shop_orders').findOne({ code: 'WEB-260915-BKUV' });
  console.log('paymentStatus:', order?.paymentStatus, 'expiresAt:', order?.expiresAt);
  await c.close();
})().catch(console.error);
