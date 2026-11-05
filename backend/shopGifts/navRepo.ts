import type { Db } from 'mongodb';
import { publicReadCache } from '../cache/readCache.js';
import { syncBus } from '../syncBus.js';
import { DEFAULT_GIFT_NAV_CONFIG, GIFT_NAV_CONFIG_COL, type GiftNavConfig } from './types.js';

const CONFIG_DOC_ID = 'current_nav_config';

export async function getGiftNavConfig(db: Db): Promise<GiftNavConfig> {
  const col = db.collection(GIFT_NAV_CONFIG_COL);
  const doc = await col.findOne({ _id: CONFIG_DOC_ID as any });
  if (!doc) {
    return structuredClone(DEFAULT_GIFT_NAV_CONFIG);
  }

  return {
    headerTitle: String(doc.headerTitle || DEFAULT_GIFT_NAV_CONFIG.headerTitle),
    headerSubtitle: String(doc.headerSubtitle || DEFAULT_GIFT_NAV_CONFIG.headerSubtitle),
    b2bTitle: String(doc.b2bTitle || DEFAULT_GIFT_NAV_CONFIG.b2bTitle),
    b2bSubtitle: String(doc.b2bSubtitle || DEFAULT_GIFT_NAV_CONFIG.b2bSubtitle),
    b2bHref: String(doc.b2bHref || DEFAULT_GIFT_NAV_CONFIG.b2bHref),
    b2bEnabled: typeof doc.b2bEnabled === 'boolean' ? doc.b2bEnabled : true,
    categories: Array.isArray(doc.categories) && doc.categories.length > 0
      ? doc.categories
      : structuredClone(DEFAULT_GIFT_NAV_CONFIG.categories),
    updatedAt: doc.updatedAt,
  };
}

export async function updateGiftNavConfig(db: Db, input: GiftNavConfig): Promise<GiftNavConfig> {
  const col = db.collection(GIFT_NAV_CONFIG_COL);
  const now = new Date().toISOString();

  const toSave = {
    _id: CONFIG_DOC_ID as any,
    headerTitle: input.headerTitle,
    headerSubtitle: input.headerSubtitle,
    b2bTitle: input.b2bTitle,
    b2bSubtitle: input.b2bSubtitle,
    b2bHref: input.b2bHref,
    b2bEnabled: input.b2bEnabled,
    categories: input.categories,
    updatedAt: now,
  };

  await col.updateOne(
    { _id: CONFIG_DOC_ID as any },
    { $set: toSave },
    { upsert: true }
  );

  await publicReadCache.invalidate('gifts');
  syncBus.publish('content', 'gifts');

  return {
    ...input,
    updatedAt: now,
  };
}
