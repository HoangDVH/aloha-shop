---
trigger: model_decision
description: "Applies whenever planning, designing, or implementing a new feature, API, endpoint, business workflow, major backend modification, or cross-cutting refactoring."
---

# Feature Development Workflow

When implementing new capabilities or refactoring existing modules in this repository, follow this disciplined engineering process:

## 1. Requirements Understanding & Repository Discovery
- Analyze the user request thoroughly.
- Locate existing patterns in the codebase before drafting new code:
  - Backend modules reside in `backend/` as domain-driven folders (`shopCampaigns/`, `shopOrders/`, `shopAuth/`, `shopWholesale/`, `shopCatalog/`).
  - Frontend components reside in `frontend/components/` and `frontend/app/`.
- Review related domain documentation:
  - Refer to `@docs/api/` for endpoint structures.
  - Refer to `@docs/WHOLESALE_ORDER_SYNC.md` when touching wholesale or KiotViet order logic.
  - Refer to `@docs/KE_HOACH_UU_DAI_VOUCHER.md` when touching promotions, vouchers, or campaigns.

## 2. Define Acceptance Criteria & Implementation Plan
- Document expected behaviors, edge cases, error conditions, and API responses.
- Break down the implementation into incremental steps:
  1. Data Schema & Zod Validators (`schema.ts` / `types.ts`).
  2. Data Access Layer / Mongo Repository queries with needed indexes.
  3. Domain Business Logic & Service functions.
  4. Express Routes & Middleware integration.
  5. Frontend UI & State hooks (if full-stack).
  6. Unit and integration tests.

## 3. Incremental Implementation
- Adhere strictly to existing coding styles (TypeScript strict mode, Express router structure, Zod validation).
- Keep modules cohesive and bounded. Do not dump unrelated logic into giant files (abide by `scripts/check-max-lines.cjs`).
- Reuse existing utilities:
  - Error helpers and message constants.
  - `syncBus.ts` for cross-node or cache invalidation events.
  - `redis.ts` for distributed locks or transient caches.

## 4. Test-Driven Verification
- For every new endpoint or critical business rule, add test cases under `tests/<feature>.test.ts`.
- Cover both the happy path and edge cases (invalid payload, boundary conditions, unauthorized access, race conditions).
- Run targeted tests using:
  ```bash
  npx tsx --test tests/<feature>.test.ts
  ```

## 5. Quality Gate & Diff Review
- Verify TypeScript types across the project:
  ```bash
  npm run typecheck:api
  npm run typecheck:web
  ```
- Inspect your git diff before marking the task complete. Ensure no unintended side-effects or leftover debug statements.
