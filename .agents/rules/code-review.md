---
trigger: model_decision
description: "Applies before finalizing any non-trivial code modification, bug fix, feature addition, or refactor to perform a structured audit of the diff."
---

# Code Review & Diff Quality Gate

Before declaring any implementation or bug fix complete, perform an end-to-end self-review of the changes.

## 1. Diff Inspection & Scope Verification
- Run `git diff` or review all modified files to ensure:
  - Only intended changes are present.
  - No accidental whitespace diffs, debug `console.log` statements, or leftover scratch files exist.
  - No secrets, API keys, or `.env` credentials are accidentally committed.

## 2. Technical Quality Checklist
1. **Correctness**: Does the code accurately satisfy all user requirements and acceptance criteria?
2. **Edge Cases & Null Safety**: Are `null`, `undefined`, empty arrays, and boundary values handled gracefully without throwing unhandled exceptions?
3. **Security**:
   - Are incoming payloads validated with Zod?
   - Are authentication and authorization checks enforced?
   - Is there any risk of NoSQL injection, XSS, or IDOR?
4. **Performance & Concurrency**:
   - Are database queries indexed?
   - Are N+1 loops avoided?
   - Are counters/claims updated atomically to prevent race conditions?
5. **Architectural Consistency**:
   - Does the implementation follow existing patterns in `backend/` and `frontend/`?
   - Are files kept under reasonable size limits (respecting `scripts/check-max-lines.cjs`)?
6. **Backward Compatibility**:
   - Are existing API contracts, database schemas, and frontend props preserved?

## 3. Mandatory Verification Checklist
Never mark a task complete without executing the appropriate quality checks:
- [ ] Backend TypeScript typecheck: `npm run typecheck:api`
- [ ] Frontend TypeScript typecheck: `npm run typecheck:web`
- [ ] Relevant automated tests: `npx tsx --test tests/<my-test>.test.ts` (or full suite `npm test`)

## 4. Final Summary
Provide a clear, concise report to the user summarizing:
- What was implemented or fixed.
- Key architectural choices made.
- What verification steps were executed and their outcomes.
