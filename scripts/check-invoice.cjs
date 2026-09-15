const { getKvInvoice } = require('../backend/shopInvoices/kvInvoiceClient.ts');
const { MongoClient } = require('mongodb');

async function checkKv() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const mainDb = client.db('aloha_shop_db');
  const inv = await getKvInvoice(mainDb, 'HD022016');
  console.log('Keys of invoice:', Object.keys(inv || {}));
  console.log('Status:', inv?.status);
  console.log('StatusValue:', inv?.statusValue);
  console.log('Total:', inv?.total);
  console.log('TotalPayment:', inv?.totalPayment);
  console.log('PayingAmount:', inv?.payingAmount);
  console.log('Debt:', inv?.debt);
  console.log('Payments:', inv?.payments);
  console.log('InvoiceDetails:', inv?.invoiceDetails?.length);
  await client.close();
}
checkKv();
