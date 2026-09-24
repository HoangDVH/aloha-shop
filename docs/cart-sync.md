# Cart merge and concurrent writes

The frontend and API must be released together. Previously opened clients without
`userId`, `revision`, or an idempotency key cannot write through the new protocol;
they must reload. Existing cart documents acquire revision 1 on their first write.
The unique `aloha_shop_carts.userId` index is required; index errors stop writes.

## Merge protocol

- `POST /api/shop/cart/merge` requires `{ userId, idempotencyKey, lines }`.
- The authenticated account must match `userId`.
- A browser Web Lock serializes initial synchronization across same-origin tabs.
  The callback reads metadata again after acquiring the lock.
- Before POST, the client persists an immutable `{ userId, key, lines }` intent in
  localStorage. An uncertain response is retried with that exact key and payload,
  including after reload. Same-tab callers share a promise.
- The server atomically writes the merged lines, next revision, and receipt in
  the same MongoDB document using a revision predicate. A repeated key returns
  the current cart without adding quantities; changing its payload returns 409.
- Keys contain their creation timestamp and UUID. The replay window is 30 days;
  expired keys are rejected, never silently treated as a new merge. Receipts are
  pruned only outside that window and capped at 512 per account. Reaching the cap
  returns 429 without discarding valid receipts. Browser clock skew over five
  minutes into the future is rejected.
- Without Web Locks/secure context or writable localStorage, guest merge stops
  with a visible retry message. There is no unsafe localStorage spinlock fallback.

## Saving and conflicts

`GET /api/shop/cart` returns `userId`, `revision`, `lines`, and `updatedAt`.
`PUT /api/shop/cart` requires `{ userId, revision, lines }`. Each tab uses its own
last acknowledged revision. A stale PUT returns `409 cart_conflict`; the frontend
loads the authoritative cart and shows a message asking the user to check it.
It does not blindly resubmit the stale snapshot with a newer version. A retry
after a lost PUT response follows this same conflict policy.

Requests time out after 15 seconds. Hydration does not echo unchanged cart data
back to the API. Rapid edits during a successful save are serialized into a
subsequent versioned save. Changes made during initial merge or after a lost merge
response are applied as a delta against the original guest snapshot.

## Tests

Run from the repository root:

```sh
node --import tsx --test tests/cart-sync.test.ts tests/checkout-submit.test.ts
```

The cart tests execute the production server write functions using an atomic
in-memory collection adapter, and the production client sync module in isolated
VM contexts representing tabs with shared storage and Web Locks. They cover
concurrency, lost responses, reload, immutable keys, account isolation, version
conflicts, and failures. They do not replace a real MongoDB/browser integration
test; no production database is contacted.
