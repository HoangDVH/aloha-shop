---
trigger: model_decision
description: "Applies whenever creating, modifying, or refactoring business logic, adding new tests, or fixing bugs."
---

# Testing Strategy & Quality Assurance

When writing or maintaining tests in this repository:

## 1. Test Framework & Organization
- Tests are executed using Node.js built-in test runner via `tsx`:
  ```bash
  npm test
  # Or run a targeted test file:
  npx tsx --test tests/<spec-name>.test.ts
  ```
- Test files reside in `tests/*.test.ts` and test helpers in `tests/helpers/`.
- Name test files predictably after the feature or subsystem under test (e.g. `tests/order-checkout.test.ts`).

## 2. Testing Principles
- **Behavior-Driven**: Tests must verify business contracts, input validation boundaries, authorization guards, and edge cases. Never write superficial tests simply to chase coverage numbers.
- **Bug Fix Regressions**: When fixing a bug, write a failing regression test first that replicates the defect, then apply the fix to make the test pass.
- **Mocking & Isolation**:
  - Prefer pure functional tests for calculating pricing, discounts, shipping, and voucher eligibility.
  - For tests requiring database operations, use in-memory/mock DB patterns or skip gracefully when `TEST_MONGO_URI` is not provided.
  - Clean up test state after runs to prevent cross-test pollution.

## 3. High-Priority Test Scenarios
- **Validation**: Rejection of invalid types, out-of-range values, malformed inputs, and dangerous characters.
- **Authorization**: Verification that unauthenticated users or users with incorrect roles (e.g. `KH_LE` attempting wholesale `KH_SI` actions) receive 401/403.
- **Race Conditions**: Concurrent operations (e.g. simultaneous quota claims, stock reservations, order submissions) must maintain data consistency.
- **Idempotency**: Repeated webhooks or duplicate requests should produce safe, identical outcomes without duplicate records or payments.

## 4. Verification Check Before Completion
Run the relevant test group or targeted file once before declaring it verified:
```bash
npx tsx --test tests/<my-feature>.test.ts
```

Prefer `npm run test:quick -- sharing|vouchers|recovery` for routine changes.
Run only the affected layer's typecheck locally; CI runs both. Do not repeat passed checks
unless relevant code changes. After two failures of the same browser test, inspect traces
and fix the cause before rerunning; do not loop the full suite or use `--repeat-each`.
Full browser tests run on scheduled/manual CI. Routine local browser checks use
`npm test --prefix tests/browser-qa` (Chromium smoke only). Do not download browsers
or run full CI locally by default. Explicit user requests to skip local tests take precedence;
report what was skipped rather than claiming it passed.
