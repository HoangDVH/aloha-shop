import type { Express } from 'express';
import type { Db } from 'mongodb';
import type { GetDb as GetOpsDb } from '../auth/middleware.js';
import { ensureGiftIndexes } from './giftRepo.js';
import { registerGiftPublicRoutes } from './routes/public.routes.js';
import { registerGiftAdminRoutes } from './routes/admin.routes.js';

export function registerShopGiftRoutes(app: Express, getOpsDb: GetOpsDb, getShopDb: () => Promise<Db>) {
  registerGiftPublicRoutes(app, getShopDb);
  registerGiftAdminRoutes(app, getOpsDb, getShopDb);

  void getShopDb()
    .then((db) => ensureGiftIndexes(db))
    .catch((e) => console.warn('[shopGifts] index/seed error:', e?.message || e));
}

export * from './types.js';
export * from './giftRepo.js';
