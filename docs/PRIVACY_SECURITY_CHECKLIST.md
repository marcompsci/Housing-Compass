# Privacy & security checklist

✅ done and tested · ⏳ needs a production setting or credential · ⚖️ counsel review needed

## Access control
- ✅ RLS on every table. Public reads only active, non-demo, non-rejected listings. Evidence, audit, applications, held messages and landlord docs are reviewer- or owner-only.
- ✅ RBAC: `user` / `reviewer` / `admin`. No self-elevation. Verification, review, lead and landlord decisions are reviewer-only functions.
- ✅ Server-side validation: zod on every document (client and edge), SQL checks on prices, bases, budgets and text lengths.
- ⏳ Supabase Auth rate limits + CAPTCHA on sign-up (dashboard setting)

## Abuse & fraud
- ✅ Rate limits: anonymous search 60/min/IP; 30 messages/h; 10 new conversations/day; reports 10/h; appeals 3/h
- ✅ Masked contacts until a tour is confirmed. Payment/SSN requests held.
- ✅ Risk signals: upfront payment, wire/crypto/gift cards/payment links, duplicate photos (dHash), copied text, price anomaly, impersonation, address mismatch, Fair Housing wording
- ✅ No automated "fraud" verdicts. Neutral-language guard. Appeals.
- ⏳ Upload malware scanning for photos/documents (backlog. No upload pipeline yet.)

## Personal data
- ✅ Location: approximate (~1 km), on-device, never uploaded, not persisted. Android coarse location only.
- ✅ Income/savings: on device only
- ✅ No SSN or bank details ever requested for browsing, messaging or tours
- ✅ Self-service deletion (`delete_my_data`)
- ✅ Logs redact email/phone/contact/location/token/details/address
- ⏳ Encryption at rest: Supabase default (AES-256). Private storage bucket for evidence. Rotate keys.
- ⚖️ Privacy policy (CCPA/CPRA), retention schedule for evidence and messages

## Platform
- ✅ Secrets only server-side. CI blocks service-role strings in app code. gitleaks.
- ✅ Dependency audit (high/critical fail CI). zod upgraded for GHSA-mrhx-c7xc-m3w5.
- ✅ CSP, HSTS, frame-ancestors none, nosniff (web)
- ✅ Health endpoint + structured logs. No PII in telemetry.

## Legal review items (do not treat as compliance claims)
- ⚖️ Fair Housing wording list; shared-housing exemptions
- ⚖️ California application-fee rules (screening-fee limits, refunds, reusable screening reports) before showing fee guidance as rules
- ⚖️ Deposit limits (California AB 12, in effect since 2024) before adding any deposit-cap warnings
- ⚖️ Terms of each data source (see `DATA_SOURCES.md`)
- ⚖️ Messaging retention and lawful-request handling
