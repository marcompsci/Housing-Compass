# Status report — v0.28 (2026-11-21): 25 more phases — where the month's money goes

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Partial bill payments | Record part of a bill paid this month; only the rest stays due. | `billPartial`, Bills & budget |
| 2 | Remaining due in safe-to-spend | Plan, Today and safe-to-spend use what's left on a bill. | `applyPartials` |
| 3 | Edit a spend | Tap a logged spend to change amount or category. | `updateSpend` |
| 4 | Other money in | Log tax refunds, gifts, bonuses, things sold. | `otherIncome`, Paycheck |
| 5 | Other money in counted | Shown in the monthly report and cash flow. | Monthly report |
| 6 | Monthly cash flow | Money in vs out for this month, with what's left. | `monthCashFlow`, Money hub |
| 7 | 50/30/20 check | Needs / wants / savings share of income, labeled as a guide. | `rule503020` |
| 8 | Calendar: debt minimums | Minimum payments appear on their due day. | Calendar |
| 9 | Calendar: trials and returns | Trial end and return-by dates appear on the calendar. | `trackerObligations` |
| 10 | Trial-ending reminder | Local notification the day before at 10am. | `trackerReminders` |
| 11 | Return-deadline reminder | Local notification 2 days before. | `trackerReminders` |
| 12 | Lease-end reminders | Local notifications at 60 and 30 days. | `trackerReminders` |
| 13 | Ask: due today | What's due today. | Ask |
| 14 | Ask: due tomorrow | What's due tomorrow. | Ask |
| 15 | Ask: income | Pay, side and other money this month. | Ask |
| 16 | Ask: saved this month | Goal contributions this month. | Ask |
| 17 | Ask: what changed | Spending this month vs last. | Ask |
| 18 | Ask: 50/30/20 | Needs/wants/savings split. | Ask |
| 19 | Rotating examples | Ask examples change daily; every example is checked to parse to its own topic. | `askExamples` |
| 20 | Spending search | Search spends by note, category or date. | Weekly spending |
| 21 | Clear other money in | New choice in Money settings → clear one section. | `clearSection` |
| 22 | Backup & export | New data in backups (strict schema), My data export and restore. | `RenterBackupSchema` |
| 23 | Translations | All new text in English, Spanish and Chinese. | `strings.ts` |
| 24 | Tests | 8 new core tests (313 total) and 10 new end-to-end checks. | `v028.test.ts`, e2e |
| 25 | Docs & install | Version bump, docs, iPhone install. | docs |

Still needs Omari: merge the PR, Supabase keys, data authorizations, `eas init`, counsel and native-speaker reviews (now including the 50/30/20 wording), App Store URLs and screenshots. The 76 research leads expired on Nov 15 and must be re-checked before any use.

---

# Status report — v0.27 (2026-11-20): 30 more phases — focus on what matters next

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Ask: spending by category | "How much did I spend on coffee?" (en/es/zh keywords). | `detectCategory` |
| 2 | Ask: roommates | Who owes whom. | `iouBalances` |
| 3 | Ask: a goal by name | Progress and ETA for a named goal. | `findByName`, `goalEta` |
| 4 | Ask: lease | Days until the lease ends. | Ask |
| 5 | Ask: what to pay first | Priority order with what the balance covers. | `payPriority`, `coverage` |
| 6 | Ask: biggest costs | Top monthly costs and total. | `biggestCosts` |
| 7 | Ask: share | Share an answer (iOS share sheet); answers are selectable. | Ask |
| 8 | Pay-first order | Housing → utilities → minimums → other → subscriptions, soonest first. | `payPriority` |
| 9 | Coverage | How far today's balance goes down that list. | `coverage` |
| 10 | Pay-first card | On the Today card when money is short. | Money → Today |
| 11 | Shortfall help | Call early; links to payment-plan/fee letters and found money. | Money → Today |
| 12 | Next up | The single most urgent item at the top of My plan. | `nextUp` |
| 13 | Plan filters | All / Money / Credit / Home. | `filterPlan` |
| 14 | Done for today | Hide a plan item until tomorrow. | `planHidden` |
| 15 | Urgent count | "N soon" tag in the My plan header. | My plan |
| 16 | Favorite spends | Save the last spend as a favorite. | `favSpends` |
| 17 | One-tap logging | Tap a favorite to log it. | Weekly spending |
| 18 | Undo | Undo the last logged spend. | Weekly spending |
| 19 | Where to pay | A note per bill (site, app or phone); no passwords or account numbers. | `billPayInfo` |
| 20 | Pay info on bills | Shown on each bill row. | Bills & budget |
| 21 | Debt milestones | 25/50/75/100% paid celebrated when a balance is updated. | `debtMilestonesCrossed` |
| 22 | Money settings | Privacy, morning summary, weekly limit, hourly pay in one place. | `/settings` |
| 23 | Clear one section | Delete one kind of data (8 choices) with confirmation. | `clearSection` |
| 24 | Settings link | In the money hub tools. | Money hub |
| 25 | Report: top category | Monthly report shows the top spending category. | `monthRecap` |
| 26 | Backup & privacy | New data in backups (strict schema), export and clear. | `RenterBackupSchema` |
| 27 | Translations | 62 new strings in en/es/zh. | `strings.ts` |
| 28 | Core tests | 7 new tests. | `test/v027.test.ts` |
| 29 | Browser checks | 15 new checks; screenshots 90–92. | e2e |
| 30 | iPhone install | Built and installed on the connected iPhone. |  |

### Tests (all passing)
- Core: 305 unit tests
- Database: 22 SQL sections + 5 contract tests (no schema change)
- Browser e2e: 233 checks

---

## Previous: v0.26 (2026-11-20): 30 more phases — a smarter assistant and an everyday routine

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Ask: rent | Next rent amount and due date, or that this month is paid. | `/ask` |
| 2 | Ask: side income | This month, this year and tax set-aside. | `sideProfit`, `sideGoalProgress` |
| 3 | Ask: taxes | Next estimated-tax date and set-aside so far. | `estimatedTaxDates` |
| 4 | Ask: subscriptions | Count, monthly and yearly cost. | Ask |
| 5 | Ask: free trials | Next trial ending and its price. | `trialStatus` |
| 6 | Ask: emergency fund | Amount and months of rent + bills it covers. | `emergencyFund` |
| 7 | Ask: bill by name | "How much is my PG&E?" → amount, due day, paid this month. | `findBillByName` |
| 8 | Ask: how am I doing | Safe to spend, what's due this week, all-bills-paid streak. | Ask |
| 9 | Ask history | Last 10 questions saved; recent ones as chips. | `rememberAsk` |
| 10 | Follow-up questions | Related questions after each answer; all 39 phrasings (en/es/zh) verified to parse. | `FOLLOW_UPS` |
| 11 | Debt due day | Optional due day for each card or loan minimum. | `Debt.dueDay` |
| 12 | Debt minimums in My plan | Due within 10 days, or past due this month. | `debtPlanItems` |
| 13 | Mark minimum paid | Per-debt toggle for this month. | `debtPaid`; Debt payoff |
| 14 | Minimums count everywhere | Included in safe to spend, week ahead, Can I afford this? and Ask. | `debtObligations`; `lib/moneyNow.ts` |
| 15 | Morning summary | Minimums included in the daily notification. | `lib/reminders.ts` |
| 16 | Paid from Today | The Today card's Paid button also handles debt minimums. | Money → Today |
| 17 | Paycheck split | Bills / savings / debt / spending %, presets and custom, with dollar amounts. | `splitPaycheck`; Paycheck planner |
| 18 | Split on payday | Payday checklist shows the split of the check. | Money → Today |
| 19 | Lease end | Date and countdown on the rent screen. | `components/LeaseEnd.tsx` |
| 20 | Lease reminder | My plan from 90 days before the lease ends. | `leasePlanItems` |
| 21 | Goal priority | Move a goal up; the top goal is labeled. | Savings goals |
| 22 | Completed goals | Finished goals move to their own section. | Savings goals |
| 23 | Quick-add spend | Log a spend right from the Today card. | Money → Today |
| 24 | Combined CSV | Bills, debts, spends and side income in one file. | `moneyCsv`; Backup |
| 25 | Report: debt minimums | Monthly report adds minimums paid. | `monthReport` |
| 26 | Badge | 3 months of debt minimums (13 badges). | `badges` |
| 27 | Backup & privacy | New data in backups (strict schema), export, clear; deleting a debt clears its paid history. | `RenterBackupSchema` |
| 28 | Translations | 57 new strings in en/es/zh. | `strings.ts` |
| 29 | Core tests | 11 new tests. | `test/v026.test.ts` |
| 30 | Browser checks | 12 new checks; screenshots 88–89. | e2e |

### Tests (all passing)
- Core: 298 unit tests
- Database: 22 SQL sections + 5 contract tests (no schema change)
- Browser e2e: 218 checks

---

## Previous: v0.25 (2026-11-20): 30 more phases — a money assistant you can ask

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Ask | Type a question; rules-based, answers from on-device data, nothing sent anywhere. | `core/assistant.ts` `parseAsk`; `/ask` |
| 2 | Ask: due | Payments in the next 7 days with total. | `weekAhead` |
| 3 | Ask: afford | Verdict for a price in the question. | `canAfford` |
| 4 | Ask: safe to spend | Amount until payday and per day. | `safeToSpend` |
| 5 | Ask: payday | Next payday. | `paydays` |
| 6 | Ask: debt | Total owed, debt-free months and interest at minimums. | `payoffPlan` |
| 7 | Ask: budget | Spent this week and month vs limit. | `weekSpending`, `monthRecap` |
| 8 | Ask: net worth | Current net worth. | `netWorthNow` |
| 9 | Ask: credit | Card use and latest score you entered. | `cardUtilization`, `scoreTrend` |
| 10 | Ask: savings | Saved vs target across goals. | Ask |
| 11 | Ask in 3 languages | Spanish and Chinese keywords; example chips in each language. | `parseAsk` |
| 12 | Ask help | Fallback explains what it can answer; answers link to the right tool. | Ask |
| 13 | Ask bar | Tap-to-ask bar at the top of the money hub. | Money hub |
| 14 | Morning summary | Local notification on days something is due, with names and total. | `dailyDigest`; `lib/reminders.ts` |
| 15 | Summary time | Off / 7 / 8 / 9 AM. | Money → Today |
| 16 | Streaks row | All-bills-paid, under-limit and saving streaks together. | Money → Today |
| 17 | Free trials | Name, end date, price after trial; cancel/remove. | `trialStatus`; `/trials` |
| 18 | Trial cost | What active trials would cost a year; what canceling saved. | `trialStatus` |
| 19 | Trial reminders | In My plan up to 5 days before the trial ends. | `trackerPlanItems` |
| 20 | Returns | Item, store, amount, return-by date; mark returned. | `returnStatus` |
| 21 | Return reminders | In My plan up to 7 days before the deadline. | `trackerPlanItems` |
| 22 | Roommate nudge | Someone has owed you for 14+ days → reminder. | `trackerPlanItems` |
| 23 | Monthly report | Rent, late fees, bills paid, spending, side income, savings; shareable. | `monthReport`; `/month-report` |
| 24 | Report in My plan | First 5 days of each month. | `trackerPlanItems` |
| 25 | Purchase in work hours | Shown in Can I afford this? and Ask. | `purchaseImpact` |
| 26 | Goal delay | How many weeks a purchase pushes back your first goal. | `purchaseImpact`, `goalEta` |
| 27 | Badges | 12 badges from real progress, with progress counts. | `badges`; `/badges` |
| 28 | Links | Ask, trials, report, badges in the money hub; Ask in My plan tools. |  |
| 29 | Backup, privacy, translations | New data in backups (strict schema), export, clear, Face ID lock; 94 new strings in en/es/zh. | `RenterBackupSchema` |
| 30 | Tests | 8 new core tests (incl. 12 Ask phrasings); 11 new browser checks. | `test/v025.test.ts`, e2e |

### Tests (all passing)
- Core: 287 unit tests
- Database: 22 SQL sections + 5 contract tests (no schema change)
- Browser e2e: 206 checks, screenshots 85–87

---

## Previous: v0.24 (2026-11-20): 25 more phases — habits, budgets and peace of mind

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Privacy mode | Hides every dollar amount as $••• across the money screens. | `usd` in `components/forms.tsx` |
| 2 | Privacy toggle | Eye button on the money hub and My plan. | `components/PrivacyToggle.tsx` |
| 3 | Tip of the day | 12 short tips written for the app, rotating daily, in en/es/zh. | `tipOfTheDay` |
| 4 | Mark paid from Today | Check off a bill right from the week-ahead list. | Money → Today |
| 5 | Payday checklist | On payday or the day before: what's due before the next payday and the total. | `paydayChecklist` |
| 6 | Payday in My plan | Same checklist as a plan item. | `habitPlanItems` |
| 7 | Weekly chart | Last 8 weeks of spending; weeks over the limit in red. | `weeklyTotals`; Weekly spending |
| 8 | Category budgets | Optional monthly budget per category. | `budgetProgress` |
| 9 | Budget bars | Spent vs budget, left or over. | Weekly spending |
| 10 | Over budget in My plan | Category over its budget this month. | `habitPlanItems` |
| 11 | Round-ups | Each logged spend rounded up to the next dollar. | `roundUps` |
| 12 | Move round-ups | One tap moves them into a savings goal. | Weekly spending |
| 13 | Habits | Repeated spends in the last 30 days with monthly cost. | `spendHabits` |
| 14 | Cut it in half | What halving a habit saves in a year. | `spendHabits` |
| 15 | Bill price history | Old and new amounts recorded when a bill's amount changes. | `recordBillChange` |
| 16 | Price trend | 'was $X (+Y%)' on each bill that changed. | `billPriceTrend` |
| 17 | Yearly bill cost | Each bill × 12 and the total. | `yearlyBillCost` |
| 18 | Monthly interest | What each debt costs in interest per month. | `monthlyInterest` |
| 19 | Avalanche vs snowball | Months, interest and first payoff for each method. | `strategyCompare` |
| 20 | Best-paying gig | Side income per hour by source. | `hourlyBySource` |
| 21 | Goal ETA | Finish date at your last-8-weeks saving pace. | `goalEta`; Savings goals |
| 22 | Last backup | Date of the last saved backup. | Backup |
| 23 | Backup reminder | My plan nudges after 30 days without a backup. | `habitPlanItems` |
| 24 | Backup, privacy, translations | New data in backups (strict schema), export, clear, Face ID lock; 48 new strings in en/es/zh. | `RenterBackupSchema` |
| 25 | Tests | 12 new core tests; 14 new browser checks. | `test/v024.test.ts`, e2e |

### Tests (all passing)
- Core: 279 unit tests
- Database: 22 SQL sections + 5 contract tests (no schema change)
- Browser e2e: 195 checks, screenshots 82–84

---

## Previous: v0.23 (2026-11-20): 20 more phases — build credit and net worth

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Card limits | Optional credit limit on each card. | `Debt.limitCents`; Debt payoff |
| 2 | Per-card use | Balance as % of each limit. | `core/grow.ts` `cardUtilization` |
| 3 | Pay to target | What to pay on each card to get under 30% and 10%. | `cardUtilization` |
| 4 | Overall card use | Total % across cards with a note on statement balances. | Debt payoff |
| 5 | Proof of payment | Confirmation number per bill paid this month. | `paidThisMonth`, `billNotes`; Bills & budget |
| 6 | Autopay check | Bills not on autopay, cards and loans first. | `autopayChecklist` |
| 7 | Late-fee waiver letter | One-time courtesy request, also usable as a phone script. | `lateFeeWaiverLetter`; Letters |
| 8 | Net worth now | Cash entered + emergency fund + goal savings + other − debts. | `netWorthNow`; `/net-worth` |
| 9 | Other assets | User's own estimate for anything else they own. | `/net-worth` |
| 10 | Monthly history | One snapshot per month, change since last month, bars. | `upsertSnapshot`, `netWorthHistory` |
| 11 | Spend categories | Food, coffee, gas, fun, shopping, other. | `Spend.category`; Weekly spending |
| 12 | Month recap | Totals by category vs last month, days with spending. | `monthRecap` |
| 13 | Spending export | CSV of every logged spend. | `spendsCsv` |
| 14 | 52-week challenge | Week n saves n × step; check weeks off; total and catch-up count. | `challengeStatus`; `/challenge` |
| 15 | Challenge options | Step $0.50–$5 and big-weeks-first mode. | `/challenge` |
| 16 | My plan | This week's challenge amount and a monthly net-worth update. | `growPlanItems` |
| 17 | Setup progress | 9-step money setup with a "Next" button until complete. | `setupProgress`; Money hub |
| 18 | Hub links | Net worth and challenge in the money tools. | Money hub |
| 19 | Backup, privacy, translations | New data in backups (strict schema), export, clear, Face ID lock; 79 new strings in en/es/zh. | `RenterBackupSchema`, `strings.ts` |
| 20 | Tests | 12 new core tests; 11 new browser checks. | `test/v023.test.ts`, e2e |

### Tests (all passing)
- Core: 267 unit tests
- Database: 22 SQL sections + 5 contract tests (no schema change)
- Browser e2e: 181 checks, screenshots 78–81

---

## Previous: v0.22 (2026-11-20): 20 more phases — decide before you spend, stay under a weekly limit, watch your credit trend

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Can I afford this? | A price checked against safe-to-spend and the 30-day forecast. | `core/coach.ts` `canAfford`; `/afford` |
| 2 | Clear verdicts | Yes / tight / wait until payday (with date) / not now, plus the lowest balance after buying. | `canAfford` |
| 3 | Update balance | Change today's balance right on the Today card. | Money → Today |
| 4 | Today shortcuts | "Can I afford this?" and "$X left this week" buttons. | Money → Today |
| 5 | Weekly spending limit | Limit for everyday spending; weeks start Monday; what's left and per day. | `weekSpending`; `/spending` |
| 6 | Quick spend log | Food / coffee / gas / fun chips, amount, remove. | `/spending` |
| 7 | Under-limit streak | Finished weeks in a row within the limit. | `underLimitStreak` |
| 8 | Weekly review | One-line summary: spent vs limit, side income, bills paid; shareable. | `weeklyReview` |
| 9 | Windfall planner | Refund/bonus split: overdue → 1-month cushion → highest-APR debt → goals → for you (0/10/20%). | `windfallPlan`; `/windfall` |
| 10 | Score journal | Scores the user sees, with date and source. The app never estimates a score. | `scoreTrend`; `/scores` |
| 11 | Score trend | Change from the same source and a bar chart of the last 12 entries. | `/scores` |
| 12 | Dispute letter | Letter to Equifax/Experian/TransUnion with placeholders; copies, never originals. | `disputeLetter`; Letters |
| 13 | Free-report reminder | Local notification at 10am the day a free weekly report is available again. | `reportReminder`; `lib/reminders.ts` |
| 14 | Bill promo watch | Optional promo-price end date on a bill. | `Bill.promoEnds`; Bills & budget |
| 15 | Promo in My plan | Reminder up to 21 days ahead to call before the price goes up. | `billPromoItems` |
| 16 | Debt progress | Update a balance; amount and % paid down since first added. | `debtProgress`; Debt payoff |
| 17 | Paid-off celebration | Paid-off debts marked 🎉 with a count. | Debt payoff |
| 18 | Tool search | Find any money tool by name. | Money hub |
| 19 | Backup, privacy, translations | New data in backups (strict schema, score 300–900), export, clear, Face ID lock; 84 new strings in en/es/zh. | `RenterBackupSchema`, `strings.ts` |
| 20 | Tests | 12 new core tests; 11 new browser checks. | `test/v022.test.ts`, e2e |

### Tests (all passing)
- Core: 255 unit tests
- Database: 22 SQL sections + 5 contract tests (no schema change)
- Browser e2e: 170 checks, screenshots 73–77

Still blocked on the owner: merge, re-verify the 76 expired research leads, Supabase keys, data agreements, `eas init`, counsel and native-speaker review, App Store URLs and screenshots.

---

## Previous: v0.21 (2026-11-20): 30 more phases — know what's safe to spend, track your credit, get paid what your time is worth

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Safe to spend | Today's balance minus everything due before the next payday; per-day amount, or the shortfall. | `core/assist.ts` `safeToSpend`; Money → Today |
| 2 | Week ahead | Rent and bills due in the next 7 days with a total. | `weekAhead` |
| 3 | All-bills-paid streak | Months in a row with every bill checked off. | `allPaidStreak` |
| 4 | Today card | New top section of the money hub. | `/money` |
| 5 | Side-work expenses | Phone & data, supplies, platform fees, other; warns not to double-count car costs with the mileage rate. | `SideExpense`; Side income |
| 6 | Profit-based set-aside | Tax set-aside now on profit after mileage and expenses. | `sideProfit` |
| 7 | Real hourly pay | Optional hours per payout; pay per hour before and after costs. | `sideProfit` |
| 8 | Monthly side goal | Progress bar, amount left and per day. | `sideGoalProgress` |
| 9 | Fuller export | Expenses included in the side-income CSV. | Side income |
| 10 | Translated tax labels | Quarterly payment labels now in all three languages (BACKLOG #33). | Side income |
| 11 | Bill wins log | Company, what you asked, result (lowered / credit / no / waiting), monthly and one-time savings. | `/wins` |
| 12 | Savings won | Next-12-month savings including subscriptions marked to cancel; win rate. | `savingsWon` |
| 13 | Free report checks | Per bureau: last checked and when the free weekly report is available again; official site only. | `reportCheckStatus`; `/credit-tools` |
| 14 | Hard inquiries | When each stops counting for FICO (1 year) and leaves the report (2 years). | `inquiryStatus` |
| 15 | Disputes | Bureau, item, sent date, 30-day response date, late flag, FTC guide. | `disputeStatus` |
| 16 | Statement timing | Card statement-closing day → "pay by" 2 days earlier. | `statementTiming`; Debt payoff |
| 17 | Promo rates | Monthly amount to clear a card before its promo rate ends. | `promoPlan` |
| 18 | Pay off by a date | Fixed payment per debt for 12/24/36 months, with interest. | `paymentForMonths` |
| 19 | Credit in My plan | Report check available, dispute due/late, pay before close, promo ending. | `creditPlanItems` |
| 20 | Roommate balances | Who owes whom, net per person, settle up. | `iouBalances`; `/roommates` |
| 21 | "Your share" message | Polite message with share, total, due date and how to pay; sent only by the user. | `shareMessage` |
| 22 | Bills in work hours | Hourly pay setting; every bill shows hours of work. | `hoursToCover`; Bills & budget |
| 23 | Rent in work hours | Hours of work per month for rent. | Bills & budget |
| 24 | Shut-off scam warning | Utilities don't demand gift cards, crypto or payment apps. | Bills & budget |
| 25 | New links | Money hub: bill wins, credit tracker, roommates; Credit builder → tracker; Split → roommates; Plan tab → tracker. | |
| 26 | Year in review | Adds side-work expenses and money saved by asking. | `yearInReview` |
| 27 | Backup & restore | All new records in the strict backup schema. | `RenterBackupSchema` |
| 28 | Privacy | New records in "Download my data" and "Clear this device"; Face ID lock on the new screens. | `lib/myData.ts`, `LockGate` |
| 29 | Translations | 141 new strings in English, Spanish and Simplified Chinese. | `strings.ts` |
| 30 | Tests | 16 new core tests; 15 new browser checks. | `test/v021.test.ts`, e2e |

### Tests (all passing)
- Core: 243 unit tests
- Database: 22 SQL sections + 5 contract tests (no schema change)
- Browser e2e: 159 checks, screenshots 68–72

Still blocked on the owner: merge, iPhone install, re-verify the 76 expired research leads, Supabase keys, data agreements, `eas init`, counsel and native-speaker review, App Store URLs and screenshots.

---

## Previous: v0.20 (2026-11-20): 20 more phases — earn more, keep more, never get surprised

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Local allowed increases | SF 1.6% (Mar 2026–Feb 2027), Oakland 2.3% (from Aug 1, 2026), Berkeley 1.0% (2026), LA RSO 3% (Jul 2026–Jun 2027), each with its official page. Checked 2026-11-20. | `core/earn.ts` `LOCAL_INCREASES` |
| 2 | Statewide cap presets | Attorney General's 2026–27 caps (SF area 8.8%, LA 8.7%, SD 8.2%, Riverside 8.1%); one tap fills the CPI. | `STATE_CAPS_2026_27` |
| 3 | Local check in the increase checker | Pick a city: allowed %, highest new rent and how far over a notice is. | `localIncreaseCheck`; Rent increase checker |
| 4 | Deposit interest | Official SF (4.2%) and Berkeley (0.9%, 2025) rates with a simple estimate and link. | `DEPOSIT_INTEREST`; `/deposit-interest` |
| 5 | Side income | Log gig/freelance earnings; month, year and by-source totals. | `sideIncomeSummary`; `/side-income` |
| 6 | Tax set-aside | Pick 15–30%; set-aside on profit after mileage. Not tax advice. | Side income |
| 7 | Quarterly tax dates | Form 1040-ES due dates; shown on Side income and in My plan within 45 days when you have side income. | `estimatedTaxDates`, `taxPlanItems` |
| 8 | Mileage log | Business miles at the IRS rate for the trip date (70¢ 2025; 72.5¢ Jan–Jun 2026; 76¢ from Jul 1, 2026); CSV export. | `IRS_MILEAGE_RATES` |
| 9 | Yearly costs | Car registration, insurance, gifts: monthly amount to set aside, progress, "paid — start next year's". | `yearlyPlan`; `/yearly` |
| 10 | Yearly costs everywhere | Monthly total on the money hub; due items in My plan. | `yearlyPlanItems` |
| 11 | Due-date suggestions | Flags bills due 1–3 days before payday and suggests asking for a day after payday. | `dueDateSuggestions`; Bills & budget |
| 12 | What-if extra payment | Months sooner and interest saved for an extra monthly amount. | `extraPaymentImpact`; Debt payoff |
| 13 | Saving streak | Goal contributions are logged; weeks in a row with a contribution. | `savingStreakWeeks`; Savings goals |
| 14 | Milestones | Celebrates passing 25/50/75/100% of a goal. | `crossedMilestones` |
| 15 | Bill changes | Statement import flags tracked bills whose latest charge moved 10%+; one tap updates the amount. | `billChanges`; Import |
| 16 | Year in review | Rent paid and on time, late fees, bills checked off, side income and savings; share as text. | `yearInReview`; `/year-review` |
| 17 | Earn more & keep more | New money-hub section: side income, found money, deposit interest, rent-increase check. | Money hub |
| 18 | Backup, export, lock | New records in backups (strict schema), "Download my data" and "Clear this device"; Face ID lock on the new screens. | `RenterBackupSchema`, `lib/myData.ts` |
| 19 | Translations | 107 new strings in English, Spanish and Simplified Chinese. | `strings.ts` |
| 20 | Tests | 14 new core tests; 14 new browser checks. | `test/v020.test.ts`, e2e |

Sources checked 2026-11-20: sf.gov (1.6%, deposit interest 4.2%), oaklandca.gov RAP (2.3%), rentboard.berkeleyca.gov (1.0% AGA), housing.lacity.gov (3%), oag.ca.gov/rentcaps (statewide caps), irs.gov (mileage rates, Form 1040-ES). Local figures change every year — see BACKLOG #30.

### Tests (all passing)
- Core: 227 unit tests
- Database: 22 SQL sections + 5 contract tests (no schema change)
- Browser e2e: 144 checks, screenshots 63–67

Still blocked on the owner: merge, iPhone install, re-verify the 76 expired research leads, Supabase keys, data agreements, `eas init`, counsel and native-speaker review, App Store URLs and screenshots.

---

## Previous: v0.19 (2026-11-19): 20 more phases — know where you stand, ask for help, stay ahead of every due date

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Does this home fit? | On every listing: share of take-home pay, what's left after this rent and your bills, and months to save the move-in cost. | `listingFit`; `components/FitPanel.tsx` |
| 2 | Save for this home | One tap creates a savings goal for the listing's move-in total, dated to its move-in date. | Listing detail |
| 3 | Rent-reporting request letter | Asks the landlord to report on-time rent (Civil Code §1954.07). | `rentReportingRequest`; Money → Letters |
| 4 | Payment-plan letter | For rent or a utility: amount owed split into up to 12 payments, start date, short reason; asks utilities about assistance. | `paymentPlanRequest` |
| 5 | Ways to lower a bill | Tips for every bill category (CARE/FERA, LifeLine, low-income internet, rate and due-date requests). | `BILL_SCRIPTS`; Bills & budget |
| 6 | Money calendar | Month grid with paydays, rent and bill due dates; tap a day for details; month total. | `monthCalendar`; `/calendar` |
| 7 | Where the money went | Statement spending grouped into housing, bills, groceries, eating out, transport, shopping, cash/transfers. Not saved. | `spendingSummary`; Import |
| 8 | Repeating charges | Finds monthly charges you aren't tracking (same merchant, ±10%, ~monthly) and adds them as bills. | `findRecurring` |
| 9 | Pay detection | Detects pay frequency and amount from deposits and fills the paycheck plan. | `detectIncome` |
| 10 | Emergency fund meter | Months of rent + bills covered and what reaches 3 months. | `emergencyFund`; Money |
| 11 | Money check | 0–100 checklist score from your own records (clearly not a credit score). | `moneyCheck`; Money |
| 12 | Next best step | The first unmet item links straight to the tool that fixes it. | Money |
| 13 | Weekly check-in | Sunday 6pm local reminder. | `nextWeeklyCheckIn`; `lib/reminders.ts` |
| 14 | Debt payoff dates | Calendar month each debt is paid off (avalanche). | `payoffDates`; Debt payoff |
| 15 | Split what's left | Each paycheck's leftover split into goals / extra debt / buffer by a chosen preset. | `leftoverSplit`; Paycheck planner |
| 16 | At-risk payments | My plan flags any rent or bill due on a day the forecast goes below $0. | `atRiskObligations` |
| 17 | Paydays & goal dates in My plan | Paydays with set-aside amount and goal target dates appear in the 30-day list. | `moneyPlanItems` |
| 18 | Backup & export | Emergency fund and split settings included in backups and "Download my data". | `RenterBackupSchema` |
| 19 | Translations | 105 new strings in English, Spanish and Simplified Chinese. | `strings.ts` |
| 20 | Tests | 14 new core tests; 16 new browser checks. | `test/v019.test.ts`, e2e |

### Tests (all passing)
- Core: 213 unit tests
- Database: 22 SQL sections + 5 contract tests (no schema change)
- Browser e2e: 130 checks, screenshots 59–62

---

## Previous: v0.18 (2026-11-19): 20 more phases — plan every paycheck, get out of debt, find money you're owed

| # | Phase | What it does | Where |
|---|---|---|---|
| 1 | Paycheck setup | Weekly, every 2 weeks, twice a month or monthly; take-home per check; a real payday to count from. | `core/money.ts`; Money → Paycheck planner |
| 2 | Paycheck planner | Assigns rent and each unpaid bill to the last paycheck before it's due; shows "set aside" and "left over" per check, and anything due before the next check. | `paycheckPlan`, `upcomingObligations` |
| 3 | 30-day forecast | Today's balance + paychecks − rent/bills, day by day; lowest point and a warning if it drops below $0. | Paycheck planner |
| 4 | Payday reminders | Local notification on payday: how much to set aside and for what. | `lib/reminders.ts` |
| 5 | Bank CSV import | Paste a bank's CSV export (Amount or Debit/Credit columns, several date formats). Read on the phone, never stored. | `parseBankCsv`; Money → Import |
| 6 | Payment matching | Suggests rent/bill matches (±$1 or 2%, ±10 days, name match = "likely"); user confirms; logs rent and marks bills paid. | `matchTransactions` |
| 7 | Debt payoff | Avalanche vs snowball with extra monthly amount: debt-free month, total interest, order; flags plans that never finish. | `payoffPlan`; Money → Debt payoff |
| 8 | Credit utilization | Per-card and overall use, band, and how much to pay to get under 30% / 10%. Not saved. | `utilization`; Money → Credit builder |
| 9 | Credit checklist | Free weekly reports (AnnualCreditReport.com), rent reporting, autopay minimums, utilization, fewer hard pulls, free disputes (FTC). | Credit builder |
| 10 | Savings goals | Move-in, emergency, deposit goals: progress, per month and per paycheck to hit the date. | `goalPlan`; Money → Savings goals |
| 11 | Found money | Official programs: unclaimed property (claimit.ca.gov), CalEITC/YCTC, free VITA tax help, CalFresh (BenefitsCal), CARE/FERA, California LifeLine, LIHEAP, free credit reports — with a "never pay to apply" warning. Checked 2026-11-19. | `FOUND_MONEY`; Money → Found money |
| 12 | Subscription audit | Mark subscriptions you don't use; see monthly and yearly savings. | Bills & budget |
| 13 | Late fee tracking | Record a late fee with a rent payment; total for the year. | Rent tracker |
| 14 | Roommate split | Equal or share-based split that always adds up to the exact cent. Nothing saved. | `splitByShares`; Money → Split |
| 15 | Quick setup | Three skippable steps: rent, paycheck, bills. | `/setup` |
| 16 | Backup & restore | Save a JSON backup file; restore by pasting — validated with a strict schema before anything is replaced. | `RenterBackupSchema`; Money → Backup |
| 17 | Money hub | Snapshot: next payday + set-aside, lowest balance ahead, debt-free date, goal progress; links to every tool. | `/money`, Plan tab |
| 18 | Lock & privacy | Face ID lock covers all new money screens; data export and "Clear this device" include the new records. | `LockGate`, `lib/myData.ts` |
| 19 | Translations | All new screens in English, Spanish and Simplified Chinese (225 new strings each). | `strings.ts` |
| 20 | Deterministic tests | The browser clock is frozen in e2e so date rules (lead expiry, due dates) give the same result every run. | `scripts/e2e-screenshots.mjs` |

Note: the 76 research leads passed their 14-day recheck window on Nov 15 and are now hidden in the app (as designed). They need to be re-verified or removed.

### Tests (all passing)
- Core: 199 unit tests (13 new)
- Database: 22 SQL sections + 5 contract tests (no schema change)
- Browser e2e: 114 checks (17 new), screenshots 53–58

---

## Previous: v0.17 (2026-11-02): 10 more phases — every bill on time, a budget that adds up

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
