# Housing Compass — Architecture (Phase 1 proposal, implemented through Phase 2)

## Repo inspection (Phase 1)
No existing repository was provided; the project was started from an empty workspace on 2026-11-01. The two source PDFs (research leads, build prompt) were read and are the only inputs.

## Shape

```
Housing Compass/
├─ packages/core/          Pure TypeScript domain: zod schema, pricing, categories, budget,
│                          search/filters, trust state machine, risk signals, staleness,
│                          source adapters, research-lead + demo data. 100% unit-tested.
├─ apps/mobile/            Expo SDK 58 + Expo Router. One codebase → iOS, Android, Web.
│   └─ src/app/            Screens (file-based routes)
│   └─ src/map/            ListingsMap.tsx (MapLibre Native) / ListingsMap.web.tsx (maplibre-gl)
│   └─ src/data/           Repository interface (Local now → Supabase in Phase 3)
├─ supabase/
│   ├─ migrations/         Postgres + PostGIS schema, trust triggers, RLS
│   ├─ seed/               GENERATED: seed.sql (prod-safe), seed.demo.sql (dev only)
│   └─ tests/              SQL trust/RLS tests (+ local-only Supabase stub)
├─ scripts/                seed builder, db test runner, e2e+screenshots, data builders
└─ .github/workflows/ci.yml
```

### Why one Expo app instead of Expo + a separate Next.js site
Expo Router exports a static web build from the same screens, so web, iOS and Android share every component and trust rule. A separate Next.js site is only worth adding if we later need server-rendered SEO pages for individual listings (roadmap, Phase 7). The domain logic lives in `packages/core`, so a Next.js app could import it unchanged.

## The trust model — enforced in three places
1. **`packages/core`** (client + edge functions): `ListingSchema` refuses impossible records (per-bed price on an entire unit, verified without evidence, official level from a non-official source, demo without the DEMO label). `markManagerVerified` requires all six checks with evidence and a human reviewer. Automation can only `flagForReview` or `expireIfStale`.
2. **Postgres triggers** (`enforce_listing_trust`): the same rules, so a buggy client or leaked key cannot vouch for a listing. Every verification/status change writes an append-only `audit_events` row.
3. **RLS**: the public can read only `active` listings at OFFICIAL / MANAGER_VERIFIED / UNVERIFIED levels and never demo rows; flagged/expired rows, evidence and audit logs are reviewer-only. Users can only touch their own favorites, searches, applications and notifications, and cannot elevate their own role.

| Level | How a listing gets it | Public default |
|---|---|---|
| OFFICIAL_PORTAL | Only from an authorized official-portal source (none yet; Doorway requires written authorization) | Shown |
| PROPERTY_MANAGER_VERIFIED | Reviewer uploads passing evidence for **all 6** checks (authority to rent, address/unit, availability, rent, independently found contact channel, fees) | Shown |
| SOURCE_LISTED_UNVERIFIED | Seen on a listing site / research import | Hidden; opt-in behind a warning screen |
| FLAGGED | Risk signal or payment-related user report → hidden pending a human | Never shown ("Under review", never "fraud") |
| EXPIRED | Not rechecked within 14 days, or deadline passed | Never shown |

### Risk signals (`core/trust/fraud.ts`)
Upfront payment before tour · wire/crypto/gift-card payment · duplicate photos at another address (perceptual-hash distance) · copied description (5-shingle Jaccard ≥ 0.7, different address and contact) · price < 50% of the median of ≥5 comparables (same city, category, price basis) · impersonation (claims a known manager but email domain/phone isn't theirs). Output is `hold_for_human_review` at most. Appeals table + `fileAppeal()` exist for Phase 5's dashboard.

## Pricing rules
- Every price carries `basis` (PER_BED / PER_ROOM / PER_UNIT), `qualifier` (EXACT / STARTING_AT / RANGE) and `basisConfirmed`.
- DB constraint: entire unit ⇔ PER_UNIT; bed in shared room ⇒ PER_BED.
- Search groups bases within a tab; Compare renders one table per basis.
- Base rent ≠ total monthly (base + confirmed recurring fees) ≠ move-in cost (deposit + one-time costs). Unknown parts show "Not confirmed", never $0.
- Budget: rooms $500–$1,400; entire units preferred ≤ $1,400 with an adjustable hard max that can never exceed $2,000 (also a DB check on `user_profiles.budget`).

## Location & privacy
- Device location: foreground permission, `Accuracy.Low`, coarsened to 2 decimals (~1 km) immediately; never sent to a server; not persisted (`partialize` drops it). Android requests only `ACCESS_COARSE_LOCATION`; fine/background are explicitly blocked.
- Manual entry: Bay Area city names or California ZIPs (offline centroid table). Other states → link-outs until a geocoder is added (Phase 3).
- Research leads were never geocoded, so they render as one dashed "approx. area" per city, never as a fake rooftop pin.

## Map
MapLibre on all platforms. Default style: OpenFreeMap (no key). If the style can't load, an offline county-outline basemap renders so the map still orients the user. Native needs a development build (MapLibre isn't in Expo Go).

## Phase 3+ backend flow (designed, schema in place)
```
pg_cron (hourly) ── expire_stale_listings()
Edge fn source-recheck ── for each source with can_ingest & authorization_ref → fetch via official API/feed → upsert → listing_checks
Edge fn risk-scan ── on insert/update → core.detectAll() → flag → audit
Edge fn notify ── drains notifications queue (dedupe_key unique) → Expo push / email
Reviewer dashboard ── evidence upload to private Storage bucket → verification_evidence → level change (trigger-checked)
```
