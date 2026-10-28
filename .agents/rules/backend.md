---
trigger: model_decision
description: "Applies whenever creating, modifying, or refactoring backend code, Express APIs, middleware, services, repositories, or server utilities."
---

# Backend Engineering Guidelines

When working on the backend (`backend/` directory or server entry points):

## 1. Architectural Consistency
- Follow the existing domain-driven module structure:
  - `backend/<domain>/types.ts` — TypeScript interfaces, types, constants.
  - `backend/<domain>/schema.ts` — Zod schemas and validation rules.
  - `backend/<domain>/<domain>Repo.ts` — MongoDB operations and query abstractions.
  - `backend/<domain>/routes/*.routes.ts` — Express route controllers.
- Reuse existing services, repositories, and utilities instead of creating redundant layers.
- Do not introduce new backend frameworks or ORMs; the project standard is native MongoDB driver (`mongodb`) with TypeScript.

## 2. Input Validation & Security
- **Zod Schema First**: Every incoming request payload (`req.body`, `req.query`, `req.params`) must be validated with Zod before processing.
- Reject unknown or dangerous inputs early. Return standardized 400 Bad Request responses with field-level errors.
- Never concatenate unvalidated user inputs into MongoDB queries (prevent NoSQL injection). Avoid passing raw objects to `{ $where }`.

## 3. Authentication & Authorization
- Use existing authentication middlewares:
  - Back-office / Staff: `requireAuth(getDb)`, `requireActive()`, `requirePermission(...)` from `backend/auth/middleware.ts`.
  - Customer / B2B Shop: `requireShopAuth(...)` from `backend/shopAuth/`.
- Verify resource ownership and role permissions on every sensitive mutation (prevent IDOR).
- Never leak sensitive credentials, password hashes, or internal tokens in API responses.

## 4. Concurrency, Race Conditions & Atomicity
- In multi-user scenarios (voucher claims, inventory deductions, flash sale slots, wallet updates):
  - Use atomic MongoDB operators: `$inc`, `$set`, `$push`, combined with filter conditions (e.g. `{ remaining: { $gt: 0 } }`).
  - Use Redis locks or atomic counters (`backend/redis.ts`) when cross-collection consistency or rate limiting is required.
  - Ensure idempotent endpoints for payment, order placement, and status synchronization.

## 5. Performance & Data Efficiency
- Avoid N+1 query patterns. Batch load related records using `$in` queries or pipeline aggregation.
- Project only required fields on large documents using MongoDB projection (`.project({ ... })`).
- Index all fields used in filters and sort operations (declare in `ensure<Domain>Indexes(db)`).

## 6. Error Handling & Logging
- Return structured error responses: `{ ok: false, status: number, code: string, error: string, details?: unknown }`.
- Log unexpected server errors with informative context while avoiding logging sensitive credentials.
- Handle Promise rejections cleanly; avoid unhandled asynchronous exceptions in Express handlers.
