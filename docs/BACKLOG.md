# Prioritized backlog

## P0 — before any public launch
1. Connect Supabase. Deploy migrations, functions and cron. Promote the first admin.
2. Reviewer UI for held messages and landlord applications (SQL functions exist: `approve_landlord`, `msg_review` policy)
3. Recheck or reject the 76 research leads before they expire (~Nov 15). Verify at least a few real listings end-to-end.
4. Counsel review: Fair Housing wording list, application-fee and deposit guidance, privacy policy
5. Request data-sharing authorization: BAHFA/MTC (Doorway), LAHD (AAHR), LACDA (Housing Resource Center)

## P1 — competitive gaps
6. Photo upload with malware scanning, dHash on upload, rights attestation (no copied photos)
7. Polygon / draw-an-area search and saved areas
8. Commute times (511 / LA Metro GTFS) instead of straight-line distance
9. Manager response metrics on listing cards (view exists; show when n ≥ 5)
10. Price-drop and availability alerts from `price_history` / `listing_checks`
11. Calendar export (.ics) for confirmed tours

## P2
12. Spanish for the new LA, messaging and landlord screens, plus native-speaker review. Then Chinese, Korean, Armenian and Tagalog (common LA languages).
13. Programs as an editable table with a review workflow
14. Landlord dashboard: edit audit trail, listing preview, lead stats
15. Application portability info (reusable screening reports) once counsel confirms the rules
16. Next.js server-rendered listing pages for SEO (reusing `packages/core`)
