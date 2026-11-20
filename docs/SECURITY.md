# Security & abuse model

**Trust rules are enforced three times:** the core library, Postgres triggers, and RLS. A client bug or a leaked anon key can't verify a listing, read evidence, or see hidden listings.

| Threat | Control | Test |
|---|---|---|
| Fake "verified" listings | 6-check evidence trigger; automation can't verify; `review_decide` is reviewer-only | `10_trust_tests.sql` §3, §6, §14; `core.test.ts` |
| Imports that claim trust | `ingestBatch` forces UNVERIFIED (OFFICIAL only from an authorized official feed) | `ingest.test.ts` |
| Unlicensed data collection | Adapters without `authorization_ref`/`consent_ref` refuse to ingest; the link checker only checks status and never retries 403/429 | `ingest.test.ts` |
| Scraping our API | `search_guard()` limits anonymous search to 60 req/min per IP | §16 |
| Report/appeal spam | 10 reports / 3 appeals per user per hour | §10 |
| Role escalation | RLS `with check` blocks self-role changes; profiles are auto-created as `user` | §9, §12 |
| Payment scams | Upfront/off-platform/impersonation detectors, payment reports auto-hide pending review, received-message checker | `security.test.ts` |
| Photo reuse | dHash plus Hamming-distance duplicate detection | `security.test.ts` |
| Defamation / false accusation | No code path labels a person or listing "fraud"; reviewers' reasons are checked for verdict words | `review.test.ts`, §14 |
| Personal data | Device location coarsened to ~1 km and never uploaded; income/savings on device only; logger redacts contact/location/email keys; self-service deletion | `core.test.ts`, §12 |
| Secrets | Only `EXPO_PUBLIC_*` reaches the client; CI blocks service-role strings in app code and runs gitleaks | CI `security` job |
| Vulnerable deps | `npm audit --omit=dev --audit-level=high` in CI. zod was upgraded 3 → 4 for GHSA-mrhx-c7xc-m3w5. | CI |
| XSS / clickjacking (web) | CSP, `frame-ancestors 'none'`, nosniff, HSTS (`public/_headers`, `vercel.json`) | — |
