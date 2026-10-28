---
trigger: model_decision
description: "Applies whenever modifying MongoDB schemas, database queries, indexes, migrations, aggregations, data integrity constraints, or Redis storage keys."
---

# Database & Data Integrity Standards

When working with MongoDB collections, queries, indexing, and data models:

## 1. Storage & Collection Standards
- Native MongoDB driver (`mongodb`) is the standard query layer. Collections are referenced via typed helpers:
  ```typescript
  const col = (db: Db) => db.collection<MyDoc>(MY_COLLECTION_NAME);
  ```
- Always define TypeScript types (`MyDoc`) matching stored MongoDB document shapes in `backend/<domain>/types.ts`.
- Keep collection names centralized as constants (e.g., `CAMPAIGNS_COL`, `ORDERS_COL`).

## 2. Indexes & Query Performance
- Every collection with active query or sort requirements must provide an `ensure<Domain>Indexes(db: Db)` function.
- Compound indexes must match query filter and sort order (Equality, Sort, Range - ESR rule).
- Use sparse or unique indexes where appropriate (e.g. unique codes, scheduled timestamps).
- Catch index creation errors gracefully with informative warnings so server startup is resilient:
  ```typescript
  await Promise.all([
    col(db).createIndex({ status: 1, updatedAt: -1 }),
    col(db).createIndex({ code: 1 }, { unique: true }),
  ]).catch((e) => console.warn("[db] ensureIndexes:", e?.message || e));
  ```

## 3. Data Integrity & Concurrency
- Never perform "read-modify-write" cycles in Node.js for state transitions, quota counters, or balance deductions.
- Leverage atomic MongoDB operations:
  ```typescript
  // Atomic decrement with condition guard
  const res = await col(db).updateOne(
    { _id: id, remainingQuota: { $gt: 0 } },
    { $inc: { remainingQuota: -1, claimedCount: 1 }, $set: { updatedAt: new Date().toISOString() } }
  );
  if (res.matchedCount === 0) {
    // Quota exhausted or record not found
  }
  ```
- Use MongoDB multi-document transactions (`session.withTransaction`) only when strictly necessary across multiple collections.

## 4. Migration & Schema Evolution Safety
- MongoDB is schemaless, but the application code is schema-driven.
- When adding new fields:
  - Provide sensible defaults in application reading logic so historical documents do not cause runtime crashes.
  - If field transformations or re-indexing are required, write idempotent migration scripts under `scripts/`.
- Never run destructive migrations (dropping collections, deleting fields) without backup snapshots and verification against `@scripts/`.
- Inspect existing data models and snapshots before altering core schemas (`aloha_products`, `orders`, `campaigns`).
