---
trigger: model_decision
description: "Applies whenever touching authentication, authorization, session management, user data, payments, file uploads, external webhooks, or database queries."
---

# Security & Vulnerability Prevention

Security is a primary concern for e-commerce, payment, and back-office operations. Adhere to these non-negotiable guidelines:

## 1. Authentication & Authorization
- Never bypass authentication checks or assume client-supplied user identifiers (`userId`, `role`) are truthful. Extract identities strictly from verified JWT tokens / session cookies.
- Check role permissions explicitly:
  - Admin / Staff: verify `active === true` and role permissions from `backend/auth/`.
  - Customer / B2B: verify buyer tier (`KH_SI`, `KH_LE`, `CTV`) from `backend/shopAuth/`.
- Prevent **Insecure Direct Object References (IDOR)**: Always ensure the authenticated user owns or is authorized to view/mutate the target resource (orders, carts, vouchers, bank details).

## 2. Input Validation & Injection Prevention
- Treat all external input as untrusted (`req.body`, `req.query`, `req.params`, headers, webhooks).
- Validate strictly using **Zod schemas**. Reject unexpected fields and disallow free-form object injection into MongoDB queries.
- **NoSQL Injection**: Never pass raw user inputs into query selectors like `{ ma: req.body.ma }` without string type coercion or Zod parsing. Prevent operators like `$ne`, `$gt`, `$where` from leaking in.
- **XSS & Link Safety**:
  - Sanitize and validate URLs using `isSafeHref` and `isSafeImageUrl` (block `javascript:`, `data:`, SVG injection).
  - In React, avoid `dangerouslySetInnerHTML` unless explicitly sanitized.

## 3. Data Protection & Secret Management
- **Never hardcode secrets**: API keys, JWT secret keys, KiotViet client secrets, and Mongo URIs must come from environment variables (`.env`).
- Never log passwords, tokens, full credit card/banking credentials, or PII into stdout, files, or audit logs.
- Protect password hashes with strong algorithms (e.g. `bcryptjs` with appropriate salt rounds).

## 4. Rate Limiting & Resource Exhaustion (DoS)
- Apply rate limiting (`backend/shopRateLimit.ts`) on public or sensitive endpoints:
  - Login & password reset.
  - OTP / verification requests.
  - Voucher claim endpoints.
  - Search and indexing endpoints.
- Constrain file uploads (size limits, allowed MIME types, sanitize file names).

## 5. Audit & Traceability
- Sensitive admin actions (changing prices, publishing campaigns, issuing vouchers, modifying orders) must write an audit record to the audit collection (e.g. `PROMOTION_AUDIT_COL`) recording actor, action, and timestamp.
