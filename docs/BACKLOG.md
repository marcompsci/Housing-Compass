# Prioritized backlog

## P0 — before any public launch
1. Connect Supabase. Deploy migrations, functions and cron. Promote the first admin.
2. ~~Reviewer UI for held messages and landlord applications~~ ✅ v0.14
3. Recheck or reject the 76 research leads before they expire (~Nov 15). Verify at least a few real listings end-to-end.
4. Counsel review: Fair Housing wording list, application-fee and deposit guidance, privacy policy
5. Request data-sharing authorization: BAHFA/MTC (Doorway), LAHD (AAHR), LACDA (Housing Resource Center)

## P1 — competitive gaps
6. Photo upload: backend pipeline ✅ v0.14 (quarantine, scan, dHash, attestation). Remaining: connect a scanner + in-app picker
7. ~~Draw-an-area search~~ ✅ v0.14 (saved with saved searches). Named saved areas ✅ v0.15
8. Commute times: labeled estimates + Apple/Google directions ✅ v0.14. Remaining: real routing from 511 / LA Metro GTFS
9. ~~Manager response metrics~~ ✅ v0.14 (listing detail)
10. ~~Price-drop alerts~~ ✅ v0.14. Availability/status alerts ✅ v0.15
11. ~~Calendar export (.ics) for confirmed tours~~ ✅ v0.14

## P2
12. Languages: Spanish for listing details/help/new screens + Simplified Chinese ✅ v0.14. Filters/account/message checker/checklists ✅ v0.15. Remaining: native-speaker review; review tools; Traditional Chinese, Korean, Armenian, Tagalog
13. ~~Programs as an editable table with a review workflow~~ ✅ v0.14
14. ~~Landlord dashboard~~ ✅ v0.14. Manager change requests with review ✅ v0.15
15. Application portability info (reusable screening reports) once counsel confirms the rules
16. Next.js server-rendered listing pages for SEO (reusing `packages/core`)

## Done in v0.16
- Server-side keyword search, local rent rules with city sources, renter rent-payment tracker (see STATUS_REPORT)

## Done in v0.17
- Move-in photos (on device), translated move-in items, rent-increase checker (statewide cap), bills & budget

## Done in v0.18
- Bank CSV import (#25), plus paycheck planner, debts, credit, goals, found money, backup (see STATUS_REPORT)

## Done in v0.19
- Listing fit, letters, money calendar, statement insights, money check (see STATUS_REPORT)

## Done in v0.20
- Local allowed-increase figures per rent board (#23, #28), side income, mileage, taxes, yearly costs, deposit interest, year in review (see STATUS_REPORT)

## Next ideas (after v0.20)
30. Recheck local rent and deposit-interest figures each year (SF/LA/Oakland change in spring/summer; Berkeley each October)
31. Add other rent-control cities with deposit-interest rules (e.g. Santa Monica, West Hollywood) from their official pages
32. Use CA-specific tax set-aside guidance only after a tax professional reviews the copy
33. Translate the quarterly date ranges ("covers") into Spanish and Chinese

## Next ideas (after v0.18)
26. Re-verify or retire the 76 expired research leads; schedule rechecks
27. Pick the CSV file directly (document picker) instead of pasting
28. Local allowed-increase figures per rent board in the increase checker
29. Optional end-to-end encrypted cloud backup (opt-in)

## Earlier ideas (after v0.17)
21. Optional encrypted backup of renter tools to the user's account (opt-in; off by default)
22. Native-speaker review of v0.16–v0.17 Spanish/Chinese strings
23. Local allowed-increase figures per rent board (with source and date) in the increase checker
24. Share photos together with the move-in record (zip or PDF), still created on the device
25. Bank-statement CSV import to mark rent and bills paid (on device, no bank login)
