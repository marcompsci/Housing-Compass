# Status report — LA expansion + competitor-driven MVP (v0.13, 2026-11-01)

## What was already in the repository
An Expo (iOS/Android/web) + Supabase/PostGIS monorepo (v0.12): trust engine, Bay Area search/map, accounts, ingestion gates, reviewer queue, alerts, application tracker, affordability checks, Spanish, security hardening, observability. Both new prompts say to keep the existing stack when a repo exists, so it was **extended, not re-scaffolded** (see `ADR.md` #1).

## What this round added
| Area | Done |
|---|---|
| Regions | `bay_area`, `la_city` ⊂ `la_county`; region picker, device-location → region, LA city/neighborhood/ZIP search; region-scoped search in app + SQL |
| LA research seed | All **48** leads (20 rooms, 20 one-bedrooms, 8 co-living) as `SOURCE_LISTED_UNVERIFIED` + `intake.reviewStatus = pending_review`, observed 2026-11-01. Raw label kept. Exact source pages from §F. **No invented URLs, addresses or ZIPs**. Co-living never classed as an apartment. |
| Official resources | LAHD property map, LA Affordable & Accessible Housing Registry (AAHR), LA County Housing Resource Center, 211 LA (plus Doorway and 211 Alameda). Programs, waitlists, eligibility and vacancies are separate fields. |
| Lead moderation | Research-lead queue: "still posted" (refreshes, never verifies) or reject (hidden from the public by RLS). Audited. |
| Cost transparency | All-in budget cap (rent + mandatory fees when known). Every card shows rent, basis, total monthly, deposit, application fee, move-in estimate, availability timestamp, source, listing type and trust status. Unknown values say "not confirmed". |
| Exact filters | Unknown is never treated as yes (strict by default; possible matches are opt-in and labeled). New filters: vouchers, utilities, parking, transit ≤10 min. |
| Unverified tab | Unverified leads sit under their own labeled section, behind a warning gate, never mixed into verified results |
| Fair Housing | Discriminatory-wording screen (incl. "No Section 8" under CA SB 329) → moderator review. Test proves search has no protected-class filters. No roommate matching by people's characteristics. |
| New risk signals | Address mismatch in descriptions, external payment links |
| Messaging | Conversations only on verified listings with a verified manager account. Contacts masked until a tour is confirmed. Payment/SSN requests held from the recipient for review. Rate limits. Tour requests. Inquiry tracker. Response-time metrics (≥5 conversations). |
| Landlord onboarding | Application → moderator verifies authority via independently found contact → manager membership. Documents are private-bucket paths only and never public. |

## Functional vs mock
| | Works now (no credentials) | Needs credentials / approvals |
|---|---|---|
| Search, filters, map, cards, compare, saved, applications, affordability, message-safety check | ✅ Local mode with bundled leads + **clearly labeled DEMO** fictional listings | Live inventory needs a Supabase project, then verified listings |
| Accounts, sync, server search, reviewer RPCs, messaging, landlord onboarding | ✅ All SQL tested on real Postgres 16 + PostGIS | A Supabase project (URL + anon key; service-role key as a secret) |
| Messaging in the app | ✅ Demo threads on fictional listings (no replies; labeled) | Real threads need Supabase + an approved landlord account |
| Push notifications | Code + queue tested | `eas init` project id, `EXPO_ACCESS_TOKEN` |
| Official data feeds | Link-outs only | **Written authorization** from BAHFA/MTC (Doorway), LAHD (AAHR) and LACDA (HRC) before any automated import |
| Aggregators (Zillow, Apartments.com, HotPads, Rent.com, Roomies) | Link-outs only | Licensing/partnerships. No scraping. |
| Real listing photos | Perceptual hashing implemented | Upload pipeline + malware scanning of uploads (backlog) |

## Tests (all passing)
- Core: 114 unit tests (incl. 20 LA/competitor + 5 message-guard parity tests)
- Database: 19 SQL test sections (trust, RLS, accounts, ingestion, review, notifications, rate limits, ops, LA regions + lead moderation, messaging/onboarding) + a 5-test DB↔app contract suite
- Browser e2e: 32 checks incl. LA region, co-living, programs, lead moderation, masked/held messaging, inquiries
- Edge functions: Deno typecheck

## Not done (see BACKLOG.md)
- Polygon (draw-on-map) search
- Photo upload with scanning
- Programs as a database table (currently versioned in code with a `checkedOn` date)
- Translation of the new LA/messaging screens
- A reviewer UI for held messages and landlord applications (the SQL functions exist)
