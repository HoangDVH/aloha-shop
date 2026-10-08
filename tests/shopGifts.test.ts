import test from 'node:test';
import assert from 'node:assert/strict';
import { giftCollectionInputSchema, giftCollectionUpdateSchema } from '../backend/shopGifts/schema.js';
import type { Db } from 'mongodb';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { loadGiftProducts, giftProductFilter } from '../backend/shopGifts/products.js';
import { registerGiftPublicRoutes } from '../backend/shopGifts/routes/public.routes.js';
import { registerGiftProductAdminRoutes } from '../backend/shopGifts/routes/products.routes.js';
import { getGiftBySlug, updateGiftAdmin } from '../backend/shopGifts/giftRepo.js';

test('giftCollectionInputSchema validates valid input', () => {
  const sample = {
    slug: 'nguoi-thuong',
    title: 'Chậu Cây Màu Hồng Dành Cho Nàng',
    subtitle: 'Món quà ngọt ngào dịp 20/10',
    tag: '20/10',
    recipientType: 'nguoi-thuong',
    image: '/banners/ve-aloha/real-hong-ngoc-2010.jpg',
    quote: 'Có những món quà không cần nói thay quá nhiều điều...',
    includedItems: 'Chậu gốm + Nơ nhung + Thiệp tay + Túi trong',
    linkedProductCodes: ['CBHNTL'],
    order: 1,
    isActive: true,
  };

  const parsed = giftCollectionInputSchema.safeParse(sample);
  assert.equal(parsed.success, true);
});

test('gift product selection rejects blank/oversized codes and excessive selections', () => {
  for (const linkedProductCodes of [[' '], ['A'.repeat(101)], Array(101).fill('A')]) {
    assert.equal(giftCollectionUpdateSchema.safeParse({ linkedProductCodes }).success, false);
  }
  assert.deepEqual(giftCollectionUpdateSchema.parse({ linkedProductCodes: [' A ', 'B', 'A'] }).linkedProductCodes, ['A', 'B']);
  assert.deepEqual(giftCollectionUpdateSchema.parse({ linkedProductCodes: [] }).linkedProductCodes, []);
  assert.equal(Object.hasOwn(giftCollectionUpdateSchema.parse({ title: 'New title' }), 'linkedProductCodes'), false);
  assert.deepEqual(giftCollectionUpdateSchema.parse({ isActive: false }), { isActive: false });
});

test('gift products retain curated order, omit missing codes and deduplicate', async () => {
  let filter: any;
  const db = { collection: () => ({ find: (query: unknown) => {
    filter = query;
    return { toArray: async () => [{ ma: 'A', ten: 'Alpha', anh: '/a.jpg' }, { ma: 'B', ten: 'Beta', anh: '/b.jpg' }] };
  } }) } as unknown as Db;
  const products = await loadGiftProducts(db, ['B', 'MISSING', 'A', 'B']);
  assert.deepEqual(products.map((p) => p.ma), ['B', 'A']);
  assert.deepEqual(filter, giftProductFilter(['B', 'MISSING', 'A', 'B']));
  // Gift lists obey catalog visibility, sale availability and image requirements.
  assert.equal(filter.deletedAt, null);
  assert.ok(filter.$and.some((clause: any) => clause.$or?.some((part: any) => part.hienThiWeb)));
  assert.ok(filter.$and.some((clause: any) => clause.$or?.some((part: any) => part.banTrucTiep)));
  assert.deepEqual(await loadGiftProducts({} as Db, []), []);
});

test('public gift page reads persisted selections and clearing one gift leaves another intact', async () => {
  const gifts = new Map([
    ['first', { slug: 'first', isActive: true, linkedProductCodes: ['A'] }],
    ['second', { slug: 'second', isActive: true, linkedProductCodes: ['B'] }],
    ['hidden', { slug: 'hidden', isActive: false, linkedProductCodes: ['A'] }],
  ]);
  const docs = [{ ma: 'A', ten: 'Alpha', anh: '/a.jpg' }, { ma: 'B', ten: 'Beta', anh: '/b.jpg' }];
  const db = { collection: (name: string) => name === 'aloha_gift_collections' ? {
    findOne: async (q: any) => {
      const gift = gifts.get(q.slug);
      return gift && gift.isActive === q.isActive ? gift : null;
    },
    updateOne: async (q: any, update: any) => {
      const gift = gifts.get(q.slug);
      if (!gift) return { matchedCount: 0 };
      Object.assign(gift, update.$set);
      return { matchedCount: 1 };
    },
  } : { find: (q: any) => ({ toArray: async () => docs.filter((d) => q.ma.$in.includes(d.ma)) }) } } as unknown as Db;
  assert.equal(await getGiftBySlug(db, 'hidden'), null);
  const app = express();
  registerGiftPublicRoutes(app, async () => db);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await updateGiftAdmin(db, 'first', { linkedProductCodes: ['B', 'A'] });
    const response = await fetch(`${base}/api/shop/gifts/first`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.products.map((p: any) => p.ma), ['B', 'A']);
    await updateGiftAdmin(db, 'first', { linkedProductCodes: [] });
    assert.deepEqual((await (await fetch(`${base}/api/shop/gifts/first`)).json()).data.products, []);
    assert.deepEqual(gifts.get('second')?.linkedProductCodes, ['B']);
    assert.equal((await fetch(`${base}/api/shop/gifts/hidden`)).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});

test('gift product search rejects malformed queries before touching the database', async () => {
  const app = express();
  registerGiftProductAdminRoutes(app, [], async () => { throw new Error('Unexpected database access'); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/shop/admin/gifts/products`;
  try {
    for (const query of ['page=0', 'page=NaN', 'q=' + 'a'.repeat(101), 'codes=' + Array(101).fill('A').join(',')]) {
      assert.equal((await fetch(`${base}?${query}`)).status, 400);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});

test('gift image library includes gallery-only products and all selectable images', async () => {
  const docs = [
    { ma: 'GALLERY', ten: 'Gallery plant', images: ['/gallery-1.jpg', '/gallery-2.jpg'] },
    { ma: 'COVER', ten: 'Cover plant', anh: '/cover.jpg', images: ['/cover.jpg', '/detail.jpg'] },
  ];
  const db = { collection: () => ({
    countDocuments: async () => docs.length,
    find: () => {
      const cursor = { sort: () => cursor, skip: () => cursor, limit: () => cursor, toArray: async () => docs };
      return cursor;
    },
  }) } as unknown as Db;
  const app = express();
  registerGiftProductAdminRoutes(app, [], async () => db);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/shop/admin/gifts/products`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.total, 2);
    assert.deepEqual(data.items[0].images, ['/gallery-1.jpg', '/gallery-2.jpg']);
    assert.deepEqual(data.items[1].images, ['/cover.jpg', '/detail.jpg']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});

test('giftCollectionInputSchema rejects invalid slug with uppercase or special characters', () => {
  const invalid = {
    slug: 'Nguoi_Thuong!',
    title: 'Chậu Cây Màu Hồng',
    image: '/banners/ve-aloha/real-hong-ngoc-2010.jpg',
  };

  const parsed = giftCollectionInputSchema.safeParse(invalid);
  assert.equal(parsed.success, false);
});
