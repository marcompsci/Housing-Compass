# Architecture decision notes

**1. Extend Expo + Supabase; don't re-scaffold as Next.js + Prisma.**
The competitor prompt specifies Next.js + Prisma only "if the repo is empty". It wasn't, and both prompts ask to preserve conventions. Postgres + PostGIS + RLS gives database-enforced trust rules that an ORM layer alone wouldn't. Expo exports a web build from the same screens. `packages/core` is framework-free, so a Next.js SEO site could reuse it later.

**2. One trust model, mapped to each prompt's vocabulary.**
| Our level | Competitor prompt | LA research statuses |
|---|---|---|
| `OFFICIAL_PORTAL` | `OFFICIAL_SOURCE` | `official-program` |
| `PROPERTY_MANAGER_VERIFIED` (6 checks incl. authority + availability) | `VERIFIED_AUTHORITY_AND_AVAILABILITY` | `verified-by-manager` |
| `SOURCE_LISTED_UNVERIFIED` + `intake.reviewStatus` (`pending_review` / `source_found`) | `UNVERIFIED` | `source-found`, `pending-review` |
| `FLAGGED`, `EXPIRED`, `intake.reviewStatus = rejected` | `FLAGGED_OR_EXPIRED` | `expired`, `rejected` |

"Official source" never implies a confirmed vacancy. `availabilityConfirmedAt` is tracked separately.

**3. Link-out, not scraping.** Doorway's terms prohibit automated access without authorization. Aggregators have no public APIs. All are link-out connectors until written permission exists.

**4. Regions as data.** `REGIONS` with `la_city ⊂ la_county`. Places carry their region. Listings store `region` for indexed SQL filtering. Adding a metro means adding places, programs and a research or official source.

**5. Strict filters.** Unknown ≠ yes. Possible matches are opt-in and labeled. This answers the "filters return unwanted results" complaint.

**6. All-in budgets.** Caps apply to rent + mandatory recurring fees when known, in the client and in SQL (`all_in_cents`). This answers the "hidden fees" complaint.

**7. Messaging safety in the database.** The `message_guard` trigger is the enforcement point. The TypeScript `messageGuard` mirrors it for live previews, and parity is tested on both sides.

**8. Programs in code (for now).** Program facts are versioned in `packages/core/src/programs.ts` with `checkedOn` dates, so changes are reviewed. Move them to a table when non-engineers need to edit them.
