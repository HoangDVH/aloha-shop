import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { ObjectId, type Db } from 'mongodb';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { registerShopInquiryRoutes } from '../backend/shopInquiries/index.js';
import { inquiryInputSchema } from '../backend/shopInquiries/schema.js';
import { signAccessToken } from '../backend/auth/tokens.js';

const valid = () => ({ requestId: randomUUID(), source: 'b2b', companyName: 'Test Company', contactName: 'Test Contact', phone: '0901234567', quantity: '50-100', budgetPerSet: '150000', eventDate: '18/10', notes: 'Logo request' });

test('inquiry validation enforces company, contact, phone and bounded messages', () => {
  for (const patch of [{ companyName: '' }, { phone: 'abc' }, { contactName: ' ' }, { requestId: 'bad' }, { notes: 'a'.repeat(3001) }]) {
    assert.equal(inquiryInputSchema.safeParse({ ...valid(), ...patch }).success, false);
  }
  const parsed = inquiryInputSchema.parse({ ...valid(), source: 'gift_consultation', companyName: '', phone: '090 123 4567' });
  assert.equal(parsed.phone, '0901234567');
});

async function fixture() {
  const docs = new Map<string, any>();
  let fail = false;
  const project = (d: any) => { const { requestId, payloadHash, ...rest } = d; return rest; };
  const matches = (d: any, q: any) => Object.entries(q).every(([k, v]) => {
    if (k === '$or') return (v as any[]).some((part) => matches(d, part));
    if (v instanceof RegExp) return v.test(d[k]);
    return String(d[k]) === String(v);
  });
  const col = {
    createIndex: async () => 'index',
    countDocuments: async (q: any = {}) => [...docs.values()].filter((d) => matches(d, q)).length,
    findOne: async (q: any) => [...docs.values()].find((d) => matches(d, q)) || null,
    findOneAndUpdate: async (q: any, change: any) => {
      if (fail) throw new Error('Simulated DB failure');
      const existing = [...docs.values()].find((d) => matches(d, q));
      if (change.$setOnInsert) {
        if (existing) return existing;
        const d = { _id: new ObjectId(), ...change.$setOnInsert };
        docs.set(String(d._id), d);
        return d;
      }
      if (!existing) return null;
      Object.assign(existing, change.$set); existing.version += change.$inc.version;
      return project(existing);
    },
    find: (q: any) => {
      let offset = 0, limit = 20;
      const cursor = { sort: () => cursor, skip: (n: number) => { offset = n; return cursor; }, limit: (n: number) => { limit = n; return cursor; },
        toArray: async () => [...docs.values()].filter((d) => matches(d, q)).slice(offset, offset + limit).map(project) };
      return cursor;
    },
  };
  const db = { collection: () => col } as unknown as Db;
  const ops = { collection: () => ({ findOne: async (q: any) => ({ username: q._id, role: q._id === 'manager' ? 'manager' : 'staff', active: true }) }) } as unknown as Db;
  const app = express(); app.use(express.json());
  registerShopInquiryRoutes(app, async () => ops, async () => db);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (path: string, body?: unknown, method = 'POST', role?: 'manager' | 'staff') => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: 'Bearer ' + signAccessToken({ sub: role, username: role, role }) } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { docs, call, setFail: () => { fail = true; }, close: () => new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())) };
}

test('both forms persist, retries deduplicate, admin can filter and update without losing customer fields', async () => {
  const f = await fixture();
  try {
    const input = valid();
    const first = await f.call('/api/shop/quote-requests', input);
    assert.equal(first.status, 201);
    const publicData = await first.json();
    assert.deepEqual(Object.keys(publicData).sort(), ['id', 'ok']);
    assert.equal((await f.call('/api/shop/quote-requests', input)).status, 201);
    assert.equal(f.docs.size, 1);
    assert.equal((await f.call('/api/shop/quote-requests', { ...input, notes: 'changed' })).status, 409);
    assert.equal((await f.call('/api/shop/quote-requests', { ...valid(), source: 'gift_consultation', companyName: '', occasion: 'Birthday' })).status, 201);
    assert.equal(f.docs.size, 2);
    assert.equal((await f.call('/api/shop/admin/quote-requests', undefined, 'GET')).status, 401);
    assert.equal((await f.call('/api/shop/admin/quote-requests', undefined, 'GET', 'staff')).status, 403);
    const response = await f.call('/api/shop/admin/quote-requests?source=b2b&q=Test', undefined, 'GET', 'manager');
    const data = await response.json();
    assert.equal(data.total, 1); assert.equal(data.newCount, 2);
    assert.equal(data.items[0].quantity, input.quantity);
    assert.equal(data.items[0].payloadHash, undefined);
    const patch = { version: 0, status: 'quoted', adminNotes: 'Called customer' };
    const update = await f.call(`/api/shop/admin/quote-requests/${publicData.id}`, patch, 'PATCH', 'manager');
    assert.equal(update.status, 200);
    const saved = (await update.json()).item;
    assert.equal(saved.status, 'quoted'); assert.equal(saved.version, 1); assert.equal(saved.notes, input.notes);
    assert.equal((await f.call(`/api/shop/admin/quote-requests/${publicData.id}`, patch, 'PATCH', 'manager')).status, 409);
    const count = await f.call('/api/shop/admin/quote-requests/counts', undefined, 'GET', 'manager');
    assert.equal((await count.json()).newCount, 1);
  } finally { await f.close(); }
});

test('invalid submissions and database failures never return a successful receipt', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('/api/shop/quote-requests', { ...valid(), phone: 'abc' })).status, 400);
    assert.equal(f.docs.size, 0);
    f.setFail();
    const response = await f.call('/api/shop/quote-requests', valid());
    assert.equal(response.status, 500);
    assert.equal((await response.json()).ok, undefined);
    assert.equal(f.docs.size, 0);
  } finally { await f.close(); }
});
