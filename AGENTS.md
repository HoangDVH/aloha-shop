# AGENTS.md — Aloha Shop Engineering Guidelines & Autonomous Workflow

This repository hosts **Aloha Shop Standalone** (B2C e-commerce, B2B wholesale portal, CTV affiliate system, campaign discounts, and KiotViet bidirectional sync).

To guarantee production safety, zero regressions, and maintainable architecture, every agent interaction must adhere to the high-caliber software engineering workflow defined below.

---

## 1. DEFAULT ENGINEERING WORKFLOW

All non-trivial tasks (feature requests, bug fixes, refactors, schema updates, backend changes) must follow the standard sequence:

```
UNDERSTAND ➔ PLAN ➔ IMPLEMENT ➔ TEST ➔ VERIFY ➔ REVIEW
```

### Step 1: UNDERSTAND
- Analyze the user request, domain boundaries, and explicit requirements.
- Never guess conventions; inspect the repository first.
- Locate existing implementations of similar workflows in `backend/` or `frontend/`.

### Step 2: PLAN
- Identify all affected modules, endpoints, database collections, schemas, and UI components.
- Analyze security implications (authentication, role access, authorization, input validation, data exposure).
- Analyze data integrity & concurrency (transactions, optimistic locks, race guards, idempotency).
- Draft a concise, step-by-step execution plan before editing code.

### Step 3: IMPLEMENT (Incrementally)
- Adhere strictly to existing patterns (Express modular routers, Zod schemas, MongoDB collections, TanStack Query, Tailwind CSS).
- Avoid inventing new architectural abstractions or unneeded dependencies.
- Keep changes minimal, clean, and isolated. Respect file length constraints (see `scripts/check-max-lines.cjs`).

### Step 4: TEST
- Write automated tests for all newly added behaviors and edge cases.
- For bug fixes, implement regression tests that reproduce the failure before fixing it.
- Use Node's built-in test runner via `tsx --test tests/<spec>.test.ts`.

### Step 5: VERIFY
- Run only the typecheck for the changed layer locally: `npm run typecheck:api` or `npm run typecheck:web`. CI runs both before deployment.
- Execute relevant unit/integration tests once: `npm run test:quick -- sharing`, `vouchers`, `recovery`, or an explicit targeted file. Do not run the full suite by default.
- A passing check need not be repeated without a relevant new change or unresolved failure. If the same browser test fails twice, inspect its trace and diagnose before rerunning. Do not use repeated full-suite runs or `--repeat-each` for routine verification.
- Full browser regression belongs on scheduled/manual GitHub CI. Do not install browsers, run full browser CI locally, or continuously poll deployment status unless the user asks or a specific unresolved issue requires it.
- Ensure clean exits without unhandled rejections or broken contracts.

### Step 6: REVIEW
- Inspect the working git diff (`git diff` or `git status`).
- Check OWASP Top 10 security vectors, edge cases, error codes, and backwards compatibility.
- Ensure no accidental edits, unwanted temporary files, or leaked secrets remain.
- Provide a structured final report detailing what was changed and what was verified.

---

## 2. REPOSITORY ARCHITECTURE AT A GLANCE

- **Backend**: Node.js 22 + TypeScript (`backend/`), Express 4.x modular sub-applications, MongoDB Native Driver (`mongodb`), Redis 4.x caching & synchronization bus.
- **Frontend**: Next.js 15 (App Router, Turbopack, React 19), Tailwind CSS v4, Ant Design v6, TanStack React Query v5, Zustand v5, Zod v4.
- **Testing**: Native Node.js test runner executed via `tsx --test tests/*.test.ts`.
- **Validation**: Schema-first validation powered by **Zod** (`backend/*/schema.ts`, `backend/*/schemas.ts`).
- **Auth & Permissions**: JWT Access tokens (HTTP-only cookies + Bearer headers) with role guards:
  - Staff / Admin: `backend/auth/` (`requireAuth`, `requireActive`, `requirePermission`)
  - Customer / B2B Wholesale: `backend/shopAuth/` (`requireShopAuth`, `KH_SI`, `CTV`, `KH_LE`)
- **Key Documentation References**:
  - `@docs/api/` — API specifications and OpenAPI definitions
  - `@docs/WHOLESALE_ORDER_SYNC.md` — KiotViet order synchronization contract
  - `@docs/KE_HOACH_UU_DAI_VOUCHER.md` & `@docs/TESTCASE_CHIEN_DICH_UU_DAI.md` — Campaign vouchers & flash sale rules
  - `@docs/CI_CD_VPS.md` — Production VPS deployment guide
  - `@.cursor/rules/bugbot.mdc` — Bugbot security & edge case audit checklist
  - `@.cursor/rules/product-videos-baseline.mdc` — Video preservation rules for products

---

## 3. CORE OPERATIONAL RULES

1. **Schema & Input Validation**: Never trust raw user inputs. Validate query params, route params, and request bodies with Zod.
2. **Safe Database Operations**:
   - Always create indexes for new query patterns.
   - For monetary calculations, voucher redemption, stock deduction, and status transitions, ensure atomicity using MongoDB `$inc`, `$set`, condition filters, or sessions/transactions.
3. **No Phantom Completions**: Report the relevant checks actually executed and any checks deferred to CI. Use the scoped verification policy above; follow explicit user instructions to skip local tests.
4. **Preserve Compatibility**: Keep REST API responses backward-compatible with deployed frontend web clients and KiotViet webhooks.
