# Session hydration

Browser session data has no matching server snapshot in this app. A fast auth
response or populated QueryClient can arrive before a streamed Suspense boundary
hydrates. HeaderAccountMenu then renders an account menu/login link over the
server's loading placeholder.

`useHydratedQuery` uses React's `useSyncExternalStore` server snapshot for the
initial render and returns the original query result after hydration. It does not
clear cached data, change requests, or alter login/logout mutations. Shop auth,
wallet, wholesale session and admin session queries use this guard.

`useShopAuth` also guards each context consumer. Guarding the provider alone is
insufficient: it may already be hydrated while a child boundary is still waiting.
New session-dependent components should use these shared hooks.

`googleStartUrl` is deterministic. GoogleAuthButton adds the browser return origin
after its own hydration, preserving the OAuth return behavior without changing
the initial anchor attributes.

Campaign queries already have their own equivalent hydration guard. Public page
data intentionally provided by the server should keep its server snapshot rather
than being indiscriminately hidden. Do not silence mismatches with
`suppressHydrationWarning`.

Verification:

```text
node --test tests/session-hydration.test.cjs tests/deals-hydration.test.cjs
npm run typecheck:web
npm run typecheck:api
node artifacts/check-hydration-pages.cjs
```

The browser audit uses fake guest/customer auth responses and intercepts cart
requests and non-read shop API requests. It never logs in or modifies real data.
Results are saved to `artifacts/hydration/report.json`.

References: https://react.dev/reference/react/useSyncExternalStore and
https://nextjs.org/docs/messages/react-hydration-error.
