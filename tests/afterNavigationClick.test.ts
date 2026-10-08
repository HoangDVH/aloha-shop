import test from 'node:test';
import assert from 'node:assert/strict';
import { afterNavigationClick } from '../frontend/lib/afterNavigationClick.js';

const afterDispatch = () => new Promise(resolve => setTimeout(resolve, 0));

test('capture loading ignores a voucher click cancelled later by the popup handler', async () => {
  const target = new EventTarget();
  let navigationStarts = 0;
  let popupOpens = 0;
  target.addEventListener('click', event => {
    afterNavigationClick(event as MouseEvent, () => navigationStarts++);
  });
  target.addEventListener('click', event => {
    event.preventDefault();
    popupOpens++;
  });
  target.dispatchEvent(new Event('click', { cancelable: true }));
  await afterDispatch();
  assert.equal(popupOpens, 1);
  assert.equal(navigationStarts, 0);
});

test('ordinary uncancelled navigation still starts loading after event handlers', async () => {
  const target = new EventTarget();
  const order: string[] = [];
  target.addEventListener('click', event => {
    afterNavigationClick(event as MouseEvent, () => order.push('loading'));
  });
  target.addEventListener('click', () => order.push('link'));
  target.dispatchEvent(new Event('click', { cancelable: true }));
  assert.deepEqual(order, ['link']);
  await afterDispatch();
  assert.deepEqual(order, ['link', 'loading']);
});

test('already cancelled clicks do not start navigation loading', async () => {
  const event = new Event('click', { cancelable: true });
  event.preventDefault();
  let starts = 0;
  afterNavigationClick(event as MouseEvent, () => starts++);
  await afterDispatch();
  assert.equal(starts, 0);
});

test('a microtask checkpoint during native capture cannot start loading before cancellation', async () => {
  const event = new Event('click', { cancelable: true });
  let starts = 0;
  afterNavigationClick(event as MouseEvent, () => starts++);
  await Promise.resolve();
  assert.equal(starts, 0);
  event.preventDefault();
  await afterDispatch();
  assert.equal(starts, 0);
});
