# Release checklist

**Backend**
- [ ] `supabase db push` (all migrations). Enable `pg_cron`. Schedule `expire_stale_listings()` hourly and `notify` every 15 minutes (with the `x-cron-secret` header).
- [ ] Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `EXPO_ACCESS_TOKEN`. Deploy functions: `supabase functions deploy ingest notify health`.
- [ ] Load `seed.sql` only (never `seed.demo.sql`). Promote the first admin.
- [ ] Uptime monitor on `/functions/v1/health`.

**App**
- [ ] `eas init` (sets the project id push needs). Production profile has `EXPO_PUBLIC_DEMO_MODE=false`.
- [ ] Licensed map style URL for production traffic.
- [ ] App Store privacy: approximate location (app functionality, not linked, not stored), email (account), no tracking. Google Play Data safety to match.
- [ ] Privacy policy and support URL. Spanish copy reviewed by a native speaker.
- [ ] Maestro flows pass on a real iOS and Android device. VoiceOver/TalkBack pass.

**Data & trust**
- [ ] Run `npm run links:check` from a normal network. Fix any broken link-out URL shapes.
- [ ] Legal review of each source's terms. Doorway stays link-out unless written authorization is on file.
- [ ] At least one listing verified end-to-end through the six-check flow before public launch.
