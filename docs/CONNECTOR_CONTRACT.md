# Connector contract

Every data source is a `SourceAdapter` (`packages/core/src/adapters/index.ts`) plus a row in `sources`.

## 1. Declare the legal basis
| Field | Meaning |
|---|---|
| `kind` | `official_portal` · `official_referral` · `property_manager` · `aggregator` · `research_import` · `demo_fixture` |
| `capabilities.ingest` | May we store records automatically? **false** unless an API, licensed feed, partnership, consented submission or permitted import exists |
| `capabilities.linkOut` | May we send users to the source's own pages? |
| `legalBasis` | Plain-language reason we're allowed to do what we do |
| `ingestBlockedBy` | What must happen before ingest can be enabled |
| `sources.authorization_ref` / `consent_ref` | Agreement or consent id. `ingestBatch` refuses official/aggregator sources without `authorization_ref` and manager imports without `consent_ref`. The DB check `ingest_needs_basis` enforces the same. |

Forbidden: scraping HTML, bypassing bot protection or robots.txt, harvesting photos, and republishing content a source's terms prohibit. The link checker only checks HTTP status and never retries 403/429.

## 2. Map records into `ListingSchema`
Required provenance (validated by zod and stored in `listings`):
- `source.sourceId`, `sourceName`, `sourceKind`
- `listingUrl` — exact URL **only if the source provided it**, else `null`
- `searchPageUrls` — pages the lead was seen on
- `sourceListingId`, `capturedAt` (ingestion), `lastPriceCheckAt`
- `verification.lastVerifiedAt`, `verification.availabilityConfirmedAt` (separate)
- `pricing.basis` + `qualifier` + `basisConfirmed`, `unit.unitType` + `unitTypeConfirmed`
- `pricing.recurringFees` / `depositCents` / `moveInCosts` / `applicationFeeCents`: **null when unknown, never 0**
- `intake` for research/manual leads: `{observedAt, rawLabel, reviewStatus, researchDoc}` (raw payload for moderators)

## 3. What ingest does for you
`ingestBatch()`:
- validates every record and rejects invalid ones with reasons
- **forces** `SOURCE_LISTED_UNVERIFIED`. Only an authorized official feed may set `OFFICIAL_PORTAL`.
- dedupes by `(source, sourceListingId)` then by normalized address + price basis
- records price changes (`price_history`) and source rechecks (`listing_checks`)
- runs the risk scan: payment requests, duplicate photos, copied text, price anomalies, impersonation, address mismatch, Fair Housing wording. Risky records are held as `FLAGGED` for a person.

The `ingest` edge function wraps this (reviewer-only, `dryRun` preview first).

## 4. Freshness
- Leads and verified listings expire after 14 days without a recheck (`expire_stale_listings()`, hourly), and when an application deadline passes.
- `/functions/v1/health` fails if anything stale is still visible.

## 5. Adding a source: checklist
1. Read the terms and record `legalBasis`. Get written permission if needed.
2. Add the adapter and a `sources` row (seeded from `ADAPTERS`).
3. Write a mapper to `ListingSchema` and unit tests with real-shaped fixtures (no fabricated live data).
4. Run `ingest` with `dryRun: true` and review the rejects.
5. Turn on ingest only after the authorization reference is stored.
