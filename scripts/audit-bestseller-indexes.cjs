// Read-only unless explicitly invoked with --apply. Never changes invoice documents.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
require('dotenv').config({ quiet: true });
const { MongoClient } = require('mongodb');
const fields = ['purchaseDate', 'createdDate', 'createdAt'];
async function main() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db(process.env.SHOP_STANDALONE_DB || 'aloha_shop_db');
    const col = db.collection('aloha_sales_invoices');
    // Execute the application's exact pipeline, rather than an approximation.
    const source = fs.readFileSync(path.join(__dirname, '../backend/shopCatalog/catalog/bestsellers.ts'), 'utf8');
    const code = source.slice(source.indexOf('const cancelRx ='), source.indexOf('const col = db.collection'));
    if (!code.includes('const pipeline =')) throw new Error('Pipeline source changed; review diagnostic extractor');
    const sinceIso = new Date(Date.now() - 90 * 86400000).toISOString();
    const pipeline = new Function('sinceIso', code.replace(': boolean', '').replace(': Record<string, unknown>', '').replace(' as unknown[]', '') + 'return pipeline;')(sinceIso);
    const describe = async () => {
      const plans = {};
      for (const window of [true, false]) {
        const options = { maxTimeMS: 30000, allowDiskUse: true };
        const plan = await col.aggregate(pipeline(window), options).explain('executionStats');
        const rows = await col.aggregate(pipeline(window), options).toArray();
        rows.sort((a, b) => String(a._id).localeCompare(String(b._id)));
        plan.resultDigest = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
        plans[window ? 'recent90d' : 'allTimeFallback'] = plan;
      }
      return plans;
    };
    const result = { at: new Date().toISOString(), database: db.databaseName, indexesBefore: await col.listIndexes().toArray(),
      dateTypes: await col.aggregate([{ $group: { _id: Object.fromEntries(fields.map(f => [f, { $type: '$' + f }])), count: { $sum: 1 } } }]).toArray(),
      before: await describe() };
    if (process.argv.includes('--apply')) {
      for (const field of fields) await col.createIndex({ [field]: 1 }, { name: `shop_bestsellers_${field}_v1`, maxTimeMS: 120000 });
      result.indexesAfter = await col.listIndexes().toArray();
      result.after = await describe();
      for (const name of Object.keys(result.before)) {
        if (result.before[name].resultDigest !== result.after[name].resultDigest) throw new Error(`Ranking changed during verification: ${name}`);
      }
    }
    const output = process.argv.find(x => x.endsWith('.json')) || 'artifacts/bestseller-index-audit.json';
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    const summarize = plans => Object.fromEntries(Object.entries(plans).map(([name, plan]) => {
      const cursor = plan.stages?.find(s => s.$cursor)?.$cursor || plan;
      const stats = cursor.executionStats || {};
      return [name, { documents: stats.totalDocsExamined, keys: stats.totalKeysExamined, ms: stats.executionTimeMillis,
        plan: cursor.queryPlanner?.winningPlan, returned: plan.stages?.at(-1)?.nReturned ?? stats.nReturned }];
    }));
    console.log(JSON.stringify({ dateTypes: result.dateTypes, before: summarize(result.before), after: result.after && summarize(result.after), output }, null, 2));
  } finally { await client.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
