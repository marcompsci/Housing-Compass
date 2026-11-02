# Data source & verification matrix

Checked 2026-11-01. "Ingest" means storing records automatically; everything else is a link-out connector that opens the source's own page.

| Source | Kind | What we do today | Why | What unlocks ingest |
|---|---|---|---|---|
| **Doorway Housing Portal** (BAHFA / MTC) — housingbayarea.mtc.ca.gov | Official portal | **Link-out** to `/listings`; shown first in every "search beyond" panel | Doorway's [Terms of Use](https://mtc.ca.gov/doorway-housing-portal-terms-use) license non-automated, non-commercial use and prohibit bots, scraping, bulk feeds and republishing without prior written authorization. The portal runs on the open-source Bloom Housing platform (which has a listings REST API), but using Doorway's instance still needs permission. | Written data-sharing authorization from BAHFA/MTC → set `sources.authorization_ref`, enable an official-feed adapter. Listings from it can be OFFICIAL_PORTAL. |
| **211 Alameda County** — 211alamedacounty.org | Official referral | Link-out to the housing page; **Call 211 / Text 898211** buttons | Referral service, not an inventory feed; no public data feed or API is published. | Data partnership with Eden I&R (211 operator). |
| **Zillow** | Aggregator | Link-out (city + price-bucket search URLs) | No public listings API; data via approved partner programs only. | Approved partnership. Even then, listings stay UNVERIFIED until manager verification. |
| **Apartments.com** (CoStar) | Aggregator | Link-out | No public API. | Licensing agreement. |
| **HotPads** (Zillow Group) | Aggregator | Link-out | No public API. | Partnership. |
| **Rent.com** (Redfin) | Aggregator | Link-out | No public API. | Licensing agreement. |
| **Research leads PDF** (2026-11-01) | Research import | **Imported** 28 records as SOURCE_LISTED_UNVERIFIED | Supplied by the project owner. Only minimal facts stored (city, street address, advertised price, unit type). No photos or descriptions are copied. Exact listing URLs were not recorded, so the group's search pages are stored instead. | n/a. Leads auto-expire 14 days after capture (≈ Nov 15, 2026) unless rechecked. |
| **LA research leads** (2026-11-01) | Research import | **Imported** 48 records as SOURCE_LISTED_UNVERIFIED, `pending_review` | Supplied by the project owner. Exact source search pages from the research's §F (HotPads LA/County, Roomies County, Apartments.com LA, Zillow LA). Co-living rows had no source → none stored. | n/a. Expire ~Nov 15, 2026 unless a moderator marks them "still posted". |
| **LAHD Affordable & Accessible Housing Registry** (accesshousingla.org) | Official portal | Link-out + phone (213) 808-8550 | No data-sharing agreement | Written authorization from LAHD |
| **LA County Housing Resource Center** (housing.lacounty.gov, LACDA) | Official portal | Link-out + 1-877-428-8844 | No data-sharing agreement | Written authorization from LACDA |
| **Roomies.com** | Aggregator | Link-out (observed `/los-angeles-county-ca`) | No public API | Partnership |
| **Property-manager CSV** | Property manager | **Imported** via the `ingest` function (reviewer-only, dry-run first) | Consented submission; `sources.consent_ref` is required or ingest refuses. Rows arrive UNVERIFIED with ZIP-level location. | n/a |
| **Manual reviewer entry** | Property manager | Review queue + six-check form (Phase 5) | A manager provides documents with consent; a reviewer independently confirms contact details. | Reviewer dashboard (Phase 5). |
| **Demo fixtures** | Demo | 10 fictional records, dev only (`seed.demo.sql`, `EXPO_PUBLIC_DEMO_MODE`) | For UI development | Never loaded in production; DB constraint forces a "DEMO" title. |

URL builders only use URL shapes observed on the sites themselves (listed in `packages/core/src/adapters/index.ts`). A link checker should run before launch (Phase 4) because sites change their URLs.

## Provenance stored per listing
`source_id`, `listing_url` (exact, when known), `search_page_urls`, `source_listing_id`, `captured_at`, `last_price_check_at`, `last_verified_at`, `verified_by`, price `basis` + `qualifier` + `basis_confirmed`, `unit_type` + `unit_type_confirmed`, eligibility (program, AMI, income limits, deadline), fees/deposit/move-in (null = unknown), `verification_level`, `status`. Every change is recorded in `audit_events`.

## Verification checklist (all six required for PROPERTY_MANAGER_VERIFIED)
| Check | Acceptable evidence |
|---|---|
| Authority to rent | Management agreement, deed/assessor record + owner ID match, or the manager's official website listing the property |
| Address & exact unit | Assessor/county record + unit confirmed with the manager |
| Unit availability | Confirmed by phone/email via the independently found contact, dated |
| Rent | Written rent quote from the manager matching the advertised basis |
| Contact channel | Phone/email found on the manager's official site or in county records, **not** from the ad |
| Fees | Written deposit, application fee and recurring fee disclosure |

## The 28 imported leads
12 room/shared leads (HotPads or Rent.com) and 16 one-bedroom leads (Apartments.com or Zillow): San Francisco, Oakland, Richmond, Berkeley, Fairfield, Santa Clara, San Jose, Fremont, San Leandro and Vallejo. See `packages/core/src/data/research-leads.ts` for the exact transcription. None is verified, and none should be described as available inventory.
