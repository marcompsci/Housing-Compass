# Observability

- **App**: `src/lib/log.ts` writes structured events and redacts keys matching email/phone/contact/lat/lng/location/token/password/details/address. Attach a crash reporter with `setLogSink()`, e.g. Sentry's `captureMessage` (add `@sentry/react-native` and a DSN; nothing is sent by default). Route crashes render `ErrorBoundary` in `app/_layout.tsx`.
- **Edge functions**: `observed()` emits one JSON line per request (`fn`, `requestId`, `status`, `ms`). Bodies and tokens are never logged.
- **Health**: `GET /functions/v1/health` returns 503 if stale listings are visible (the expiry job stopped), notifications are stuck, or payment-related reports are older than 24h. Point an uptime monitor at it.
- **Ops numbers**: `select ops_health();` (reviewers) gives listings by trust level, open reports and open appeals.
- **Tests**: core unit tests, DB trust/RLS tests (17 blocks), the DB ↔ app contract test, 19 browser e2e checks with screenshots, Maestro flows for native builds, and a Deno typecheck of the edge functions.
