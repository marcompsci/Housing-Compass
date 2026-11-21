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

## Done in v0.21
- Safe to spend, week ahead, side-work expenses and hourly pay, credit tracker, bill wins, roommates, card timing; #33 (quarterly labels now translated)

## Done in v0.22
- #34 report reminder, #35 dispute letter, #36 quick balance update; plus afford check, weekly spending, windfall, score journal, bill promo watch, debt progress

## Done in v0.23
- Card use per card, proof of payment, autopay check, late-fee letter, net worth, spending categories and recap, 52-week challenge, setup progress

## Done in v0.24
- #40 privacy mode, #41 weekly spending chart; plus budgets, round-ups, habits, payday checklist, bill price history, debt interest and strategy compare, goal ETA, backup reminder

## Done in v0.25
- Ask assistant (rules-based, en/es/zh), morning digest, streaks, trials & returns, roommate nudges, monthly report, purchase impact, badges

## Done in v0.26
- #44 more Ask intents (rent, side income, taxes, subscriptions, trials, emergency, bill lookup, overview), debt minimums with due days, paycheck split, lease end, goal order, quick-add spend, combined CSV

## Done in v0.27
- Pay-first order, next up, plan filters, money settings, clear one section, favorites/undo, where to pay, debt milestones, more Ask topics

## Done in v0.28
- Partial bill payments, edit/search spends, other money in, monthly cash flow, 50/30/20 check, calendar minimums/trials/returns, tracker and lease reminders, more Ask topics, rotating examples

## Next ideas (after v0.28)
50. Native-speaker and counsel review of the 50/30/20 wording
51. Partial payments for debts (beyond the minimum)

## Next ideas (after v0.27)
48. Counsel review of the pay-first guidance wording
49. Calendar dots for debt minimums and trials

## Next ideas (after v0.26)
46. Voice input for Ask (needs speech recognition permission)
47. Lease renewal letter template (with counsel review)

## Next ideas (after v0.25)
44. Ask: more intents (rent increase, side income, taxes) and voice input
45. Native-speaker review of Ask examples and answers

## Next ideas (after v0.24)
42. Native-speaker review of the 12 daily tips
43. Home-screen widget (needs a native extension)

## Next ideas (after v0.23)
40. Privacy mode that hides amounts on screen
41. Charts for spending by week (needs a small chart component)

## Next ideas (after v0.22)
37. Home-screen widget: safe to spend and next due date (needs a native widget extension)
38. Pick the bank CSV file directly (document picker)
39. Opt-in end-to-end encrypted backup

## Next ideas (after v0.21)
34. Optional notification the day a free credit report can be checked again
35. Dispute letter template (with the FTC's sample as the source) in Letters
36. Remember today's balance more easily (quick "update balance" on the Today card)

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
