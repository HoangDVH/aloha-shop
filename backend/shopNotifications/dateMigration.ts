/**
 * Idempotent migration normalizing legacy ISO-string date fields to BSON Date
 * on aloha_shop_orders and aloha_shop_accounts, plus best-effort collMod schema hints.
 */
import type { Db } from "mongodb";
import { SHOP_ORDERS } from "../shopOrders/models.js";
import { SHOP_ACCOUNTS } from "../shopAuth/models.js";

function stringFieldToDateExpr(field: string) {
  const ref = `$${field}`;
  return {
    $switch: {
      branches: [
        {
          case: { $eq: [{ $type: ref }, "string"] },
          then: {
            $convert: {
              input: ref,
              to: "date",
              onError: ref,
              onNull: ref,
            },
          },
        },
        {
          case: { $eq: [{ $type: ref }, "missing"] },
          then: "$$REMOVE",
        },
      ],
      default: ref,
    },
  };
}

async function normalizeCollectionStringDates(
  shopDb: Db,
  collectionName: string,
  fields: string[]
): Promise<number> {
  const col = shopDb.collection(collectionName);
  if (typeof col.updateMany !== "function") return 0;

  const filter = {
    $or: fields.map((field) => ({ [field]: { $type: "string" } })),
  };
  const $set = Object.fromEntries(
    fields.map((field) => [field, stringFieldToDateExpr(field)])
  );

  const res = await col.updateMany(filter, [{ $set }] as any);
  return Number(res?.modifiedCount || 0);
}

async function applyBestEffortDateSchemaValidator(
  shopDb: Db,
  collectionName: string
): Promise<void> {
  if (typeof shopDb.command !== "function") return;
  try {
    await shopDb.command({
      collMod: collectionName,
      validator: {
        $jsonSchema: {
          bsonType: "object",
          properties: {
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
          },
        },
      },
      validationLevel: "moderate",
      validationAction: "warn",
    });
  } catch {
    // Mongo user may lack collMod privilege or collection may not exist yet; safe to skip.
  }
}

export async function normalizeShopOrderAndAccountDates(shopDb: Db): Promise<{
  ordersModified: number;
  accountsModified: number;
}> {
  let ordersModified = 0;
  let accountsModified = 0;
  try {
    ordersModified = await normalizeCollectionStringDates(shopDb, SHOP_ORDERS, [
      "createdAt",
      "updatedAt",
      "purchaseDate",
    ]);
    accountsModified = await normalizeCollectionStringDates(
      shopDb,
      SHOP_ACCOUNTS,
      ["createdAt", "updatedAt"]
    );
    await Promise.all([
      applyBestEffortDateSchemaValidator(shopDb, SHOP_ORDERS),
      applyBestEffortDateSchemaValidator(shopDb, SHOP_ACCOUNTS),
    ]);
    if (ordersModified > 0 || accountsModified > 0) {
      console.log(
        `[date-migration] normalized string dates -> BSON Date: orders=${ordersModified}, accounts=${accountsModified}`
      );
    }
  } catch (e: any) {
    console.warn("[date-migration] skipped:", e?.message || e);
  }
  return { ordersModified, accountsModified };
}
