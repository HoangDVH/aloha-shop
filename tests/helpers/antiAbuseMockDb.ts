import type { PromotionDoc } from "../../backend/shopPromotions/types.js";
import { PROMOTION_CLAIMS_COL } from "../../backend/shopPromotions/claimService.js";

// Bộ giả lập Mongo In-Memory chuẩn cho kiểm thử độc lập, không đụng production
export function createMockDb(initialData: Record<string, any[]> = {}) {
  const collections: Record<string, any[]> = {};
  for (const [k, v] of Object.entries(initialData)) {
    collections[k] = JSON.parse(JSON.stringify(v));
  }

  const getCol = (name: string) => {
    if (!collections[name]) collections[name] = [];
    return collections[name];
  };

  const matchesFilter = (doc: any, filter: any): boolean => {
    if (!filter || Object.keys(filter).length === 0) return true;
    for (const key of Object.keys(filter)) {
      if (key === "$or") {
        if (!filter.$or.some((f: any) => matchesFilter(doc, f))) return false;
        continue;
      }
      if (key === "$and") {
        if (!filter.$and.every((f: any) => matchesFilter(doc, f))) return false;
        continue;
      }
      const val = filter[key];
      if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
        if ("$ne" in val && doc[key] === val.$ne) return false;
        if ("$in" in val && !val.$in.includes(doc[key])) return false;
        if ("$nin" in val && val.$nin.includes(doc[key])) return false;
        if ("$lte" in val) {
          const comp = doc[key] instanceof Date ? doc[key] : new Date(doc[key] || 0);
          const target = val.$lte instanceof Date ? val.$lte : new Date(val.$lte);
          if (comp > target) return false;
        }
        if ("$gt" in val) {
          const comp = doc[key] instanceof Date ? doc[key] : new Date(doc[key] || 0);
          const target = val.$gt instanceof Date ? val.$gt : new Date(val.$gt);
          if (comp <= target) return false;
        }
        if ("$exists" in val) {
          const exists = key in doc && doc[key] !== undefined;
          if (exists !== val.$exists) return false;
        }
        if (key === "$expr") {
          const expr = filter.$expr;
          if (expr.$lt) {
            const leftExpr = expr.$lt[0];
            let leftVal = 0;
            if (leftExpr && leftExpr.$add) {
              for (const f of leftExpr.$add) {
                leftVal += typeof f === "string" && f.startsWith("$") ? Number(doc[f.slice(1)]) || 0 : Number(f) || 0;
              }
            } else {
              leftVal = typeof leftExpr === "string" && leftExpr.startsWith("$") ? Number(doc[leftExpr.slice(1)]) || 0 : Number(leftExpr) || 0;
            }
            const rightExpr = expr.$lt[1];
            const rightVal = typeof rightExpr === "string" && rightExpr.startsWith("$") ? doc[rightExpr.slice(1)] ?? Infinity : Number(rightExpr) || Infinity;
            if (!(leftVal < rightVal)) return false;
          }
          if (expr.$lte) {
            const leftExpr = expr.$lte[0];
            let leftVal = 0;
            if (leftExpr && leftExpr.$add) {
              for (const f of leftExpr.$add) {
                leftVal += typeof f === "string" && f.startsWith("$") ? Number(doc[f.slice(1)]) || 0 : Number(f) || 0;
              }
            } else {
              leftVal = typeof leftExpr === "string" && leftExpr.startsWith("$") ? Number(doc[leftExpr.slice(1)]) || 0 : Number(leftExpr) || 0;
            }
            const rightExpr = expr.$lte[1];
            const rightVal = typeof rightExpr === "string" && rightExpr.startsWith("$") ? doc[rightExpr.slice(1)] ?? Infinity : Number(rightExpr) || Infinity;
            if (!(leftVal <= rightVal)) return false;
          }
          continue;
        }
        continue;
      }
      if (doc[key] !== val) return false;
    }
    return true;
  };

  const db: any = {
    collection(name: string) {
      const list = getCol(name);
      return {
        createIndex: async () => name,
        find: (filter: any = {}) => {
          let res = list.filter((d) => matchesFilter(d, filter));
          return {
            sort: () => ({
              limit: (n: number) => ({ toArray: async () => res.slice(0, n) }),
              toArray: async () => res,
            }),
            limit: (n: number) => ({ toArray: async () => res.slice(0, n) }),
            toArray: async () => res,
          };
        },
        findOne: async (filter: any = {}, options?: any) => {
          return list.find((d) => matchesFilter(d, filter)) || null;
        },
        countDocuments: async (filter: any = {}) => {
          return list.filter((d) => matchesFilter(d, filter)).length;
        },
        insertOne: async (doc: any) => {
          const copy = { ...doc };
          if (!copy._id) copy._id = `id_${Date.now()}_${Math.random()}`;
          if (name === PROMOTION_CLAIMS_COL) {
            const dup = list.find(
              (d) =>
                d.policyGroup === copy.policyGroup &&
                d.identityType === copy.identityType &&
                d.identityKey === copy.identityKey &&
                d.state !== "released" &&
                d.orderId !== copy.orderId
            );
            if (dup) {
              const err: any = new Error("E11000 duplicate key error");
              err.code = 11000;
              throw err;
            }
          }
          list.push(copy);
          return { insertedId: copy._id };
        },
        updateOne: async (filter: any, update: any, options: any = {}) => {
          const idx = list.findIndex((d) => matchesFilter(d, filter));
          if (idx === -1) {
            if (options.upsert) {
              const newDoc = { ...(update.$setOnInsert || {}), ...(update.$set || {}) };
              if (update.$inc) {
                for (const [k, v] of Object.entries(update.$inc)) newDoc[k] = (newDoc[k] || 0) + Number(v);
              }
              newDoc._id = filter._id || `id_${Date.now()}`;
              if (name === PROMOTION_CLAIMS_COL) {
                const dup = list.find(
                  (d) =>
                    d.policyGroup === newDoc.policyGroup &&
                    d.identityType === newDoc.identityType &&
                    d.identityKey === newDoc.identityKey &&
                    d.state !== "released" &&
                    d.orderId !== newDoc.orderId
                );
                if (dup) {
                  const err: any = new Error("E11000 duplicate key error");
                  err.code = 11000;
                  throw err;
                }
              }
              list.push(newDoc);
              return { matchedCount: 0, upsertedCount: 1, modifiedCount: 1 };
            }
            return { matchedCount: 0, modifiedCount: 0 };
          }
          const target = list[idx];
          if (update.$set) Object.assign(target, update.$set);
          if (update.$inc) {
            for (const [k, v] of Object.entries(update.$inc)) target[k] = (target[k] || 0) + Number(v);
          }
          return { matchedCount: 1, modifiedCount: 1 };
        },
        findOneAndUpdate: async (filter: any, update: any, options: any = {}) => {
          const idx = list.findIndex((d) => matchesFilter(d, filter));
          if (idx === -1) {
            if (options.upsert) {
              const newDoc = { ...(update.$setOnInsert || {}), ...(update.$set || {}) };
              if (update.$inc) {
                for (const [k, v] of Object.entries(update.$inc)) newDoc[k] = (newDoc[k] || 0) + Number(v);
              }
              newDoc._id = filter._id || `id_${Date.now()}`;
              if (name === PROMOTION_CLAIMS_COL) {
                const dup = list.find(
                  (d) =>
                    d.policyGroup === newDoc.policyGroup &&
                    d.identityType === newDoc.identityType &&
                    d.identityKey === newDoc.identityKey &&
                    d.state !== "released" &&
                    d.orderId !== newDoc.orderId
                );
                if (dup) {
                  const err: any = new Error("E11000 duplicate key error");
                  err.code = 11000;
                  throw err;
                }
              }
              list.push(newDoc);
              return { value: newDoc };
            }
            return { value: null };
          }
          const target = list[idx];
          if (update.$set) Object.assign(target, update.$set);
          if (update.$inc) {
            for (const [k, v] of Object.entries(update.$inc)) target[k] = (target[k] || 0) + Number(v);
          }
          return { value: target };
        },
        updateMany: async (filter: any, update: any) => {
          let count = 0;
          for (const doc of list) {
            if (matchesFilter(doc, filter)) {
              if (update.$set) Object.assign(doc, update.$set);
              if (update.$inc) {
                for (const [k, v] of Object.entries(update.$inc)) doc[k] = (doc[k] || 0) + Number(v);
              }
              count++;
            }
          }
          return { matchedCount: count, modifiedCount: count };
        },
        deleteOne: async (filter: any) => {
          const idx = list.findIndex((d) => matchesFilter(d, filter));
          if (idx >= 0) list.splice(idx, 1);
          return { deletedCount: idx >= 0 ? 1 : 0 };
        },
      };
    },
  };

  return { db, collections };
}

// Fixture chuẩn theo mục 12
export const FIXTURE_FIRST_PROMO: PromotionDoc = {
  id: "PROMO_FIRST10",
  name: "Khách mới 10%",
  title: "Giảm 10% cho khách mua web lần đầu",
  type: "auto",
  benefitType: "goods",
  discountType: "percentage",
  discountValue: 10,
  maxDiscountVnd: 50_000,
  minOrderThreshold: 0,
  thresholdOperator: ">",
  scope: "all",
  targetCustomer: "new_web",
  budgetTotal: 5_000_000,
  budgetUsed: 0,
  budgetHeld: 0,
  usedCount: 0,
  heldCount: 0,
  status: "active",
  priority: 10,
  revision: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const FIXTURE_SHIP_PROMO: PromotionDoc = {
  id: "PROMO_SHIP20",
  name: "Hỗ trợ ship 20k",
  title: "Hỗ trợ phí vận chuyển 20k",
  type: "auto",
  benefitType: "shipping",
  discountType: "fixed",
  discountValue: 20_000,
  minOrderThreshold: 0,
  thresholdOperator: ">",
  scope: "all",
  targetCustomer: "all",
  budgetTotal: 2_000_000,
  budgetUsed: 0,
  budgetHeld: 0,
  usedCount: 0,
  heldCount: 0,
  status: "active",
  priority: 5,
  revision: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
