# Moderation SOP

**Principles:** describe what you found, never a verdict about a person. The database rejects reasons containing "fraud", "scam" and similar words. Automation can hide (flag/expire) but never vouch. Every decision is audited and can be appealed.

## Queues (Help → Reviewer tools)
| Queue | Source | Target time |
|---|---|---|
| **Payment-related reports and hold signals** | user reports (`upfront_payment`, `off_platform_payment`, `impersonation`) auto-hide the listing | **< 24 h**. `/health` fails after 24 h. |
| Other reports, appeals | `reports`, `appeals` | < 3 business days |
| Held messages | `messages.held = true` (payment, payment link, SSN/bank requests) | < 24 h |
| Landlord applications | `landlord_applications` | < 5 business days |
| Research leads (pending review) | Bay Area + LA research imports | Before they expire (14 days) |

## Research leads
1. Open the recorded source page (never a link from the ad itself).
2. If the ad is still posted at that price, choose **Still posted** with a dated note. This refreshes the lead; it does **not** verify it.
3. If it's gone, the price changed, or no source was recorded and you can't find it, choose **Reject** with a reason. Rejected leads are hidden from the public by RLS.
4. To publish as verified, use the six-check flow below.

## Six-check verification (PROPERTY_MANAGER_VERIFIED)
Get the contact from the manager's **official website or county records**, never the ad. Record evidence for every check:
1. **Authority to rent:** management agreement, deed/assessor record + identity match, or the official site listing the property
2. **Address & exact unit:** assessor record + unit confirmed. Private room vs shared bed confirmed for rooms.
3. **Availability:** dated confirmation (sets "availability confirmed")
4. **Rent:** written quote on the same basis (bed/room/unit)
5. **Contact channel:** where you found it independently
6. **Fees:** deposit, application fee, mandatory recurring fees

The DB refuses verification unless all six have passing evidence. Evidence files go in the private `evidence` bucket and are never public.

## Landlord applications
- Call or email using **public records**, not the number typed in the application. Ask for proof of authority.
- Approve with `approve_landlord()`, which creates or links the manager and a membership. Note what you checked.
- Never store ID numbers or SSNs. Request documents through the private upload path.

## Held messages
- If the message asks for money before a tour, money by wire/crypto/gift card, or an SSN/bank login: keep it held, and flag the listing if the sender is the manager.
- If it was a false positive (e.g. "the deposit is due at lease signing, after the tour"), release it with a note.
- In the app: Review → Held messages. "Keep hidden" needs a 5+ character neutral reason; "Release" needs 15+ characters, and releasing a payment-before-tour, off-platform payment or SSN request asks you to confirm twice. Every decision is audited (`review_held_message`).

## Landlord applications (Review → Landlords)
- Tick each authority check only after doing it, and write where you found it:
  1. Reached them through a contact **you** found (official website, county records, licensing board).
  2. Saw proof of authority (management agreement, property tax record or deed) — store it in the private `evidence` bucket only.
  3. The person/company matches the document.
  4. Every listed address is covered by the proof.
- The database refuses approval until all four are recorded with notes. Use "Ask for more info" when something is missing; reject after 30 days without proof.

## Research leads nearing expiry (Review → Research leads)
- Work from the top: past due and ≤2 days first. "Still posted" resets the 14-day clock but never verifies a listing.

## Fair Housing wording
Flags like "No Section 8", "adults only" or "[religion] only" go to review. Shared-living ads (renting a room in your own home) and lawful senior housing may legitimately state some preferences. Escalate uncertain cases to counsel. Don't publish allegations about a person.

## Takedown & appeals
- **Remove** (`review_decide 'remove'`) for confirmed problems. Always give the reason, in neutral words.
- An owner or reporter can appeal. A different reviewer decides with `appeal_decide()`. Upholding returns the listing to unverified, never straight to verified.
