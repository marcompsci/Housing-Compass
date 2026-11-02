# Status report — v0.17 (2026-11-02): 10 more phases — every bill on time, a budget that adds up

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Bills tracker | Add utilities, phone, internet, insurance, car, card, loan and subscription bills (amount, due day, autopay); check them off each month; due-soon and late flags. | `core/bills.ts`; Plan → Bills & budget |
| 2 | Bills in My plan + reminders | Upcoming bills show in My plan; bills not on autopay get the same local reminders as rent (3 days before and on the day). | `billPlanItems`, `billReminders` |
| 3 | Monthly budget | Take-home pay vs rent + bills: what's left, rent share, "tight"/"short" warnings, 30% note. Device only. | Bills & budget → My month |
| 4 | Rent increase checker | Checks a notice against California's statewide cap (5% + regional CPI, max 10%; Civ. Code §1947.12) and notice period (30/90 days; §827), with exemptions and a link to local offices. Not legal advice. | Plan → Rent increase checker |
| 5 | Rent history summary | One-page, clearly self-prepared summary of on-time months for rental applications. | Rent tracker |
| 6 | On-time milestones | 1, 3, 6, 12 and 24-month badges and "N more months" progress. | Rent tracker |
| 7 | Calendar export | One .ics with monthly recurring all-day events for rent and every bill (correct on short months), with a 3-day alert. | Bills & budget |
| 8 | Move-in photos | Take or choose photos for worn/damaged items; copied into the app's private folder, never uploaded, no location data; counted in the shared record; deleted by "Clear this device". | Move in & move out (phone app) |
| 9 | Face ID / passcode lock | Optional lock for rent, bills, move-in and waitlists; unlock lasts until the app goes to the background. | Plan → Lock my renter tools (phone app) |
| 10 | Translations | Move-in checklist items and My plan details in Spanish and Chinese; all new screens in en/es/zh. | `ROOM_ITEM_TEXT`, `strings.ts` |

New native modules: `expo-image-picker`, `expo-local-authentication` (the iPhone app needs a rebuild). Permission text explains that photos stay on the phone; no microphone access.

### Tests (all passing)
- Core: 186 unit tests (10 new)
- Database: 22 SQL sections + 5 contract tests (no schema change this round)
- Browser e2e: 97 checks (10 new), screenshots 50–52

---

## Previous: v0.16 (2026-11-02): 10 more phases — pay rent on time, build credit, protect your deposit

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Rent tracker | Set rent amount, due day, grace days and payee; log each payment (month, date, amount, method, confirmation). Shows next due date, days left or late, on-time streak and months on time. Split payments count once they add up. | `core/renterTools.ts`; Plan → Rent tracker |
| 2 | Reminders | Local notifications 3 days before rent is due and at 9am on the due day, and 1 hour before confirmed tours. Scheduled on the phone (works offline, nothing sent to a server); permission asked only when turned on; kept in sync as rent, payments and tours change. Web shows the same items in My plan. | `lib/reminders.ts` |
| 3 | Payment history export | CSV of every payment with due date and on-time flag, for a landlord reference or a rent-reporting service. Spreadsheet formulas are neutralized. | Rent tracker → Export |
| 4 | Move-in condition record | Room-by-room checklist (good / worn / damaged + note, each dated), progress and damage count, and a shareable text record. | Plan → Move in & move out |
| 5 | Deposit-return countdown | 21 days from move-out (Civ. Code §1950.5), receipts over $125, photos rule, bad-faith penalty; a factual request letter to share. General information, not legal advice. | same screen |
| 6 | Local rent rules & help | Official offices only: SF Rent Board, Oakland RAP, Berkeley Rent Board, San José Rent Stabilization, LA City RSO (LAHD), LA County DCBA, plus the statewide fallback — website and tap-to-call. | `core/localRules.ts`; Help, Plan |
| 7 | Program waitlists | Track Section 8 / public housing / building waitlists: joined date, confirmation number, next check-in, status. Flags check-ins due within a week or overdue. | Plan → Program waitlists |
| 8 | My plan tab | One list of the next 30 days: rent due, tours (local time), application deadlines and follow-ups, deposit due back, waitlist check-ins — urgent items flagged. | new Plan tab |
| 9 | Server keyword search + recent searches | `search_listings(..., p_query)` filters on the server (every word must match; case/accents ignored) so results aren't cut off at the row limit; the last 6 searches show as chips on Explore (device only). | migration `20261105000000_v016.sql` |
| 10 | App Store readiness | iOS privacy manifest (no tracking; email, coarse location and user content for app functionality only; required-reason APIs), export-compliance flag, permission text checked by a test. | `app.json`, `core/localRules.ts` `PRIVACY_DECLARATION` |

Privacy: rent payments, move-in/out records, waitlists and recent searches never leave the device. They're included in "Download my data" and removed by "Clear this device" (which also cancels scheduled reminders).

### Tests (all passing)
- Core: 176 unit tests (18 new)
- Database: 22 SQL sections (new §22: server keyword search) + 5 contract tests
- Browser e2e: 87 checks (14 new), screenshots 44–49

---

## Previous: v0.15 (2026-11-02): 10 more phases

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Know your rights (California) | Deposits (one month for most landlords since July 2024), screening-fee cap and refunds (AB 2493), reusable reports, positive rent reporting to build credit (AB 2747), vouchers as income. Each with its statute link and checked date. Not legal advice. | `core/rights.ts`; Help → Know your rights |
| 2 | Deposit & fee checks | Listings whose stated deposit is over one (or two) months' rent, or whose application fee is above the 2026 statewide screening-fee cap (about $65.86), get a soft "ask about this" note — never an accusation. | listing → What it costs; Compare |
| 3 | Keyword search + total-cost sort | Search by street, neighborhood, city or ZIP (accents and case ignored); sort by lowest total monthly cost. | Explore, Filters |
| 4 | Named saved areas | Save a drawn area ("Near work") and reapply it with one tap on the map. | Explore |
| 5 | "No longer available" alerts | When a saved home is rented, removed, put under review or expires, people who saved it get an in-app alert (respects alert settings). | `notify_listing_hidden` trigger |
| 6 | Manager change requests | Verified managers request rent/deposit/fee/move-in/availability changes or mark a home rented; a reviewer (never the requester) approves; approval updates the listing, records price history and alerts savers. | `request_listing_edit`, `decide_listing_edit`; dashboard + Review → Listing edits |
| 7 | Reports I sent | Each report's status in plain words (saved on device / waiting / being reviewed / action taken / no change). | Account → Reports I sent |
| 8 | Private notes + offline saved homes | Notes on saved homes (device only, removed when unsaved; shown in Compare). Saved homes open without a connection, re-validated and staleness-checked. | Saved |
| 9 | Compare upgrades | Application fee, cost checks, and share of income (when "My numbers" is set) rows; your notes under each table. | Compare |
| 10 | More translations | Filters, account, message checker (including its warnings) and both checklists in Spanish and Simplified Chinese. Legal summaries stay in English on purpose. | `checklistText.ts`, `strings.ts` |

### Tests (all passing)
- Core: 158 unit tests (13 new)
- Database: 21 SQL sections (new §21) + 5 contract tests
- Browser e2e: 73 checks (16 new), screenshots 38–43

---

## Previous: v0.14 (2026-11-02): 20 improvement phases

All 20 phases below are built and tested without credentials. Anything that needs the live backend is wired to real SQL functions (tested on Postgres 16 + PostGIS) and falls back to a clearly labeled demo on the device.

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Held-message review | Reviewers release or keep hidden messages held by the guard. Releasing a payment/SSN request needs a 15+ character reason and a second confirmation. Audited. | `review_held_message`, `held_messages`; Review → Held messages |
| 2 | Landlord application review | Four authority checks (independent contact, proof of authority, identity, properties), each with a note. Approval is refused by the database until all four pass. Ask-for-info and reject paths. | `record_authority_checks`, `approve_landlord`, `decide_landlord`; Review → Landlords |
| 3 | Lead expiry countdown | Research leads sorted by days until they auto-hide, with a summary (past due / ≤2 days / this week / later). | `lead_expiry_queue`; Review → Research leads |
| 4 | Draw-an-area search | Tap 3–20 points on the map. Self-crossing, tiny and county-sized shapes are refused. City/ZIP-centroid pins are never placed inside a drawn area (and the app says how many were left out). | `core/area.ts`, `search_listings(p_area)` |
| 5 | Travel estimates + directions | Wide, labeled time ranges per mode from straight-line distance; real routes open in Apple/Google Maps with coordinates only. | `core/travel.ts`; listing → Getting around |
| 6 | Price-change alerts | Saved homes' prices are watched on the device; the server notifies people who saved a home when `price_history` records a change (in-app only). Never compares per-bed with per-room. | `core/priceHistory.ts`, `notify_price_change` trigger |
| 7 | Price history panel | Only prices actually seen, with dates. Demo listings say they have none. | listing → Price history |
| 8 | Manager response metrics | Reply rate and median reply time, only after ≥5 conversations in 90 days. | `manager_response_stats`, `core/responseMetrics.ts` |
| 9 | Calendar export | Confirmed tours export a standards-compliant .ics with a 1-hour reminder and the safety note. | `core/calendar.ts`; conversation → Add to calendar |
| 10 | Tour-day checklist | Nine checks (address, inside access, identity via official contact, costs in writing, nothing paid yet…). | `core/checklists.ts` |
| 11 | Application document checklist | Per listing: ID, income, rental history; plus household documents for income-restricted homes and voucher paperwork. Ends with the privacy rule. | Applications → Documents to gather |
| 12 | Share a listing | Shared text always states the trust status (and DEMO for demo listings); no personal data; `housingcompass://listing/<id>` deep link. | `core/share.ts` |
| 13 | First-run onboarding | Three skippable screens: trust labels, what you're looking for + budget, where (privacy note). Replayable from Help. | `/welcome` |
| 14 | Alert preferences | Choose alert kinds, quiet hours and a daily push cap; synced with `set_alert_prefs`, respected by the notifier. | `/alert-settings`, `normalizeAlertPrefs` |
| 15 | Download / clear my data | JSON export of everything on the device plus `export_my_data()` from the account; clear-this-device. | Account |
| 16 | Landlord dashboard | Your listings with trust status, conversations awaiting reply, tour counts, renter's-eye preview and change history. | `my_manager_listings`, `listing_audit_trail`; `/landlord-dashboard` |
| 17 | Photo pipeline (backend) | Private quarantine → malware scan (`photo-scan` function, scanner via env) → dHash re-use check → publish. Rights attestation required by the database. | `listing_photos`, `record_photo_scan`, `publish_listing_photo` |
| 18 | Programs as data | `programs` table seeded from core; public suggestions go to `program_edits`; a *different* reviewer approves; only whitelisted fields change. | `/programs` → Suggest a correction |
| 19 | Move-in savings planner | Weeks/months and a date to cover a listing's confirmed move-in total; says plainly when it's over a year away. | `core/savings.ts`; My numbers |
| 20 | Spanish + Simplified Chinese | Listing details, Help & safety, onboarding and the new screens in Spanish; Simplified Chinese added. Language choice remembered. Pending native-speaker review. | `i18n/strings.ts`, `core/i18n.ts` |

### Tests (all passing)
- Core: 145 unit tests (31 new)
- Database: 20 SQL sections (new §20 covers every phase's SQL) + 5 DB↔app contract tests
- Browser e2e: 57 checks (25 new) + screenshots 28–37
- Edge functions: Deno typecheck incl. `photo-scan`

### Still needs credentials or people
- Supabase project + secrets; a malware-scanning service for photos (`PHOTO_SCANNER_URL`)
- In-app photo picker (needs the scanner first, so nothing unscanned is ever stored)
- Native-speaker review of Spanish and Chinese
- Real transit routing (511 / LA Metro) — estimates are labeled until then

---

## Previous: LA expansion + competitor-driven MVP (v0.13, 2026-11-01)

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
