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

## Next ideas (after v0.16)
20. Attach dated photos to the move-in record (on device) and include them in the shared record
21. Optional encrypted backup of renter tools to the user's account (opt-in; off by default)
22. Translate move-in checklist item names; native-speaker review of v0.16 Spanish/Chinese strings
23. Rent-increase checker: compare a notice against the local office's published allowed increase
