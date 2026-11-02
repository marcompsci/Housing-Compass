-- Database-level trust & RLS tests. Run by scripts/db-test.sh (and CI) after migrations + seeds.
-- Each block raises an exception on failure.
\set ON_ERROR_STOP on

-- 1. Seed: 28 research leads, all unverified, none demo.
do $$ begin
  assert (select count(*) from listings where source_id = 'research-2026-11-01') = 28, 'expected 28 Bay Area leads';
  assert (select count(*) from listings where source_id = 'research-la-2026-11-01') = 48, 'expected 48 LA leads';
  assert not exists (select 1 from listings where source_id like 'research-%' and (intake->>'reviewStatus') <> 'pending_review'), 'leads start pending review';
  assert (select count(*) from listings where source_id = 'research-la-2026-11-01' and region in ('la_city','la_county')) = 48, 'LA leads carry an LA region';
  assert not exists (select 1 from listings where source_id = 'research-2026-11-01' and verification_level <> 'SOURCE_LISTED_UNVERIFIED'), 'leads must be unverified';
  assert (select count(*) from units u join listings l on l.id = u.listing_id where l.source_id like 'research-%') = 76, 'one unit per lead';
end $$;

-- 2. A listing on an aggregator/research source cannot be marked OFFICIAL_PORTAL.
do $$ begin
  begin
    update listings set verification_level = 'OFFICIAL_PORTAL', last_verified_at = now() where id = 'lead-oakland-801-14th-st';
    raise exception 'TEST FAILED: research lead became OFFICIAL_PORTAL';
  exception when check_violation then null; end;
end $$;

-- 3. PROPERTY_MANAGER_VERIFIED requires evidence for all six checks.
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000a1', 'reviewer@test.local'), ('00000000-0000-0000-0000-0000000000b2', 'user@test.local'), ('00000000-0000-0000-0000-0000000000c3', 'other@test.local');
insert into user_profiles(id, role) values ('00000000-0000-0000-0000-0000000000a1', 'reviewer'), ('00000000-0000-0000-0000-0000000000b2', 'user'), ('00000000-0000-0000-0000-0000000000c3', 'user') on conflict (id) do update set role = excluded.role;

do $$ begin
  begin
    update listings set verification_level = 'PROPERTY_MANAGER_VERIFIED', last_verified_at = now() where id = 'lead-oakland-801-14th-st';
    raise exception 'TEST FAILED: verified without evidence';
  exception when check_violation then null; end;
end $$;

insert into verification_evidence(listing_id, check_type, passed, evidence_kind, independent_source, collected_by)
select 'lead-oakland-801-14th-st', c, true, 'phone_call', 'official property website', '00000000-0000-0000-0000-0000000000a1'
  from unnest(enum_range(null::verification_check)) c;

-- as a reviewer (signed in) it now succeeds and is audited
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
update listings set verification_level = 'PROPERTY_MANAGER_VERIFIED', last_verified_at = now() where id = 'lead-oakland-801-14th-st';
reset request.jwt.claim.sub;
do $$ begin
  assert exists (select 1 from audit_events where entity_id = 'lead-oakland-801-14th-st' and action = 'verification_change' and to_value = 'PROPERTY_MANAGER_VERIFIED' and actor_kind = 'human'), 'verification must be audited with the human actor';
end $$;

-- 4. Never mix per-bed and entire-unit pricing.
do $$ begin
  begin
    insert into units(listing_id, unit_type, is_entire_unit, price_basis, base_rent_cents) values ('lead-oakland-801-14th-st', 'one_bedroom', true, 'PER_BED', 1000);
    raise exception 'TEST FAILED: per-bed entire unit accepted';
  exception when check_violation then null; end;
end $$;

-- 5. Staleness job expires old leads (simulate by back-dating).
update listings set captured_at = now() - interval '20 days', last_price_check_at = now() - interval '20 days' where id = 'lead-richmond-421-22nd-st';
do $$ declare n int; begin
  n := expire_stale_listings();
  assert n >= 1, 'expected at least one expiry';
  assert (select verification_level from listings where id = 'lead-richmond-421-22nd-st') = 'EXPIRED', 'lead should be EXPIRED';
  assert (select status from listings where id = 'lead-richmond-421-22nd-st') = 'expired', 'status should be expired';
  assert exists (select 1 from audit_events where entity_id = 'lead-richmond-421-22nd-st' and to_value = 'EXPIRED' and actor_kind = 'system'), 'expiry audited as system';
end $$;

-- 6. Automation may not verify.
do $$ begin
  begin
    update listings set verification_level = 'PROPERTY_MANAGER_VERIFIED', last_verified_at = now(), status = 'active' where id = 'lead-richmond-421-22nd-st';
    raise exception 'TEST FAILED: automation verified a listing';
  exception when check_violation or insufficient_privilege then null; end;
end $$;

-- 7. Audit log is append-only.
do $$ begin
  begin
    delete from audit_events where true;
    raise exception 'TEST FAILED: audit delete allowed';
  exception when raise_exception then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;

-- 8. RLS as anon: sees active non-demo listings only; no flagged/expired/demo; no evidence.
set role anon;
do $$ begin
  assert not exists (select 1 from listings where verification_level in ('FLAGGED','EXPIRED')), 'anon sees hidden levels';
  assert not exists (select 1 from listings where is_demo), 'anon sees demo';
  assert (select count(*) from listings) > 0, 'anon should see public listings';
end $$;
do $$ begin
  begin
    perform 1 from verification_evidence;
    raise exception 'TEST FAILED: anon read evidence';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 9. RLS as a user: own favorites only; reports hold listing for review; no role self-elevation.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
insert into favorites(user_id, listing_id) values ('00000000-0000-0000-0000-0000000000b2', 'lead-san-francisco-535-brunswick-st');
do $$ begin
  begin
    insert into favorites(user_id, listing_id) values ('00000000-0000-0000-0000-0000000000c3', 'lead-san-francisco-535-brunswick-st');
    raise exception 'TEST FAILED: wrote another user''s favorite';
  exception when insufficient_privilege then null; end;
end $$;
do $$ begin
  begin
    update user_profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b2';
    raise exception 'TEST FAILED: role self-elevation allowed';
  exception when insufficient_privilege then null; end;
end $$;
insert into reports(listing_id, reporter_id, reason, details) values ('lead-san-francisco-1114-silver-ave', '00000000-0000-0000-0000-0000000000b2', 'upfront_payment', 'Asked for deposit before showing');
reset request.jwt.claim.sub;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
do $$ begin
  assert (select count(*) from favorites) = 0, 'user c3 must not see b2 favorites';
end $$;
reset request.jwt.claim.sub;
reset role;
do $$ begin
  assert (select role from user_profiles where id = '00000000-0000-0000-0000-0000000000b2') = 'user', 'role self-elevation must be blocked';
  assert (select verification_level from listings where id = 'lead-san-francisco-1114-silver-ave') = 'FLAGGED', 'payment report holds listing';
  assert (select status from listings where id = 'lead-san-francisco-1114-silver-ave') = 'pending_review', 'held listing pending review';
end $$;

-- 10. Report rate limit.
do $$ declare i int; begin
  for i in 1..10 loop
    insert into reports(listing_id, reporter_id, reason) values ('lead-san-francisco-1761-22nd-ave', '00000000-0000-0000-0000-0000000000c3', 'other');
  end loop;
  begin
    insert into reports(listing_id, reporter_id, reason) values ('lead-san-francisco-1761-22nd-ave', '00000000-0000-0000-0000-0000000000c3', 'other');
    raise exception 'TEST FAILED: rate limit not enforced';
  exception when sqlstate 'P0429' then null; end;
end $$;

-- 11. public_listings view never shows demo, flagged or expired.
do $$ begin
  assert not exists (select 1 from public_listings where is_demo or verification_level in ('FLAGGED','EXPIRED')), 'view leak';
end $$;

select 'ALL DATABASE TESTS PASSED' as result;

-- 12. Accounts: new auth users get a 'user' profile; delete_my_data removes personal rows.
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000d4', 'new@test.local');
do $$ begin
  assert (select role from user_profiles where id = '00000000-0000-0000-0000-0000000000d4') = 'user', 'profile auto-created as user';
end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select delete_my_data();
do $$ begin assert (select count(*) from favorites) = 0, 'favorites deleted'; end $$;
reset request.jwt.claim.sub;
reset role;
do $$ begin
  assert exists (select 1 from audit_events where action = 'data_deleted' and entity_id = '00000000-0000-0000-0000-0000000000b2'), 'deletion audited';
end $$;
select 'ACCOUNT TESTS PASSED' as result;

-- 13. Ingestion support: price changes are recorded; zip_approx is a valid precision.
update units set base_rent_cents = 90000 where listing_id = 'lead-san-jose-3641-kilo-ave-3';
do $$ begin
  assert exists (select 1 from price_history where listing_id = 'lead-san-jose-3641-kilo-ave-3' and old_cents = 89000 and new_cents = 90000), 'price change recorded';
  assert 'zip_approx'::location_precision is not null;
end $$;
select 'INGESTION TESTS PASSED' as result;

-- 14. Review workflow.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';  -- ordinary user
do $$ begin
  begin
    perform review_decide('lead-san-francisco-1114-silver-ave', 'clear_flag', 'checked with manager');
    raise exception 'TEST FAILED: non-reviewer decided';
  exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';  -- reviewer
do $$ begin
  assert (select count(*) from review_queue where id = 'lead-san-francisco-1114-silver-ave') = 1, 'flagged listing in queue';
  begin
    perform review_decide('lead-san-francisco-1114-silver-ave', 'clear_flag', 'confirmed scam');
    raise exception 'TEST FAILED: verdict language accepted';
  exception when raise_exception then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  assert review_decide('lead-san-francisco-1114-silver-ave', 'clear_flag', 'Manager confirmed by phone; no deposit requested before tours') = 'SOURCE_LISTED_UNVERIFIED', 'flag cleared';
  assert not exists (select 1 from reports where listing_id = 'lead-san-francisco-1114-silver-ave' and status = 'open'), 'reports resolved';
  begin
    perform review_decide('lead-fremont-lake-wawasee-st', 'verify', 'looks fine');
    raise exception 'TEST FAILED: verified without evidence via review_decide';
  exception when check_violation then null; end;
end $$;
reset request.jwt.claim.sub;
reset role;
do $$ begin
  assert exists (select 1 from audit_events where entity_id = 'lead-san-francisco-1114-silver-ave' and to_value = 'SOURCE_LISTED_UNVERIFIED' and actor_kind = 'human'), 'review audited';
end $$;
select 'REVIEW TESTS PASSED' as result;

-- 15. Notification queue: dedupe + atomic claim.
insert into notifications(user_id, kind, dedupe_key, title) values ('00000000-0000-0000-0000-0000000000c3', 'deadline_reminder', 'dl:x:7', 'a');
insert into notifications(user_id, kind, dedupe_key, title) values ('00000000-0000-0000-0000-0000000000c3', 'deadline_reminder', 'dl:x:7', 'dup') on conflict (user_id, dedupe_key) do nothing;
do $$ declare n int; begin
  assert (select count(*) from notifications where dedupe_key = 'dl:x:7') = 1, 'dedupe';
  select count(*) into n from claim_notifications(10);
  assert n = 1, 'claimed one';
  select count(*) into n from claim_notifications(10);
  assert n = 0, 'not claimed twice';
end $$;
select 'NOTIFICATION TESTS PASSED' as result;

-- 16. Rate limiter.
do $$ declare i int; ok boolean; begin
  for i in 1..3 loop ok := hit_rate_limit('t:1', 3, 60); assert ok, 'within limit'; end loop;
  assert not hit_rate_limit('t:1', 3, 60), 'over limit blocked';
  assert hit_rate_limit('t:2', 3, 60), 'separate keys';
end $$;
select 'SECURITY TESTS PASSED' as result;

-- 17. Ops health aggregates.
do $$ declare h jsonb := ops_health(); begin
  assert (h->>'stale_visible')::int >= 0 and h ? 'by_level' and h ? 'open_reports', 'ops_health shape';
end $$;
select 'OPS TESTS PASSED' as result;

-- 18. LA region search + lead moderation.
set role anon;
do $$ declare n int; begin
  select count(*) into n from search_listings('PRIVATE_ROOM', true, null, null, null, 200000, 500, 'la_county');
  assert n = 20, format('LA county rooms: %s', n);
  select count(*) into n from search_listings('PRIVATE_ROOM', true, null, null, null, 200000, 500, 'la_city');
  assert n between 1 and 19, 'LA city is a subset';
  select count(*) into n from search_listings('ENTIRE_1BR', false, null, null, null, 200000, 500, 'la_county');
  assert n = 0, 'verified-only default shows no LA leads';
end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  assert lead_decide('la-lead-pacoima-weidner-st', 'reject', 'Ad removed from the source page') = 'reject';
  assert lead_decide('la-lead-north-hollywood-7858-irvine-ave', 'source_found', 'Ad still posted at $815 on 2026-11-02') = 'source_found';
end $$;
reset request.jwt.claim.sub;
reset role;
set role anon;
do $$ declare n int; begin
  select count(*) into n from search_listings('PRIVATE_ROOM', true, null, null, null, 200000, 500, 'la_county');
  assert n = 19, 'rejected lead hidden from public';
  assert not exists (select 1 from listings where id = 'la-lead-pacoima-weidner-st'), 'rejected lead not readable by anon';
end $$;
reset role;
do $$ begin
  assert exists (select 1 from listing_checks where listing_id = 'la-lead-north-hollywood-7858-irvine-ave' and outcome = 'pass'), 'recheck logged';
end $$;
select 'LA TESTS PASSED' as result;

-- 19. Landlord onboarding → manager membership → messaging guard.
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000e5', 'landlord@test.local');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e5';
insert into landlord_applications(user_id, company_name, official_website, official_phone, property_addresses)
values ('00000000-0000-0000-0000-0000000000e5', 'Template Lane Rentals', 'https://templatelane.example', '+15105550100', array['800 Template Ln']);
do $$ begin
  begin
    perform approve_landlord((select id from landlord_applications limit 1), null, 'self-approve');
    raise exception 'TEST FAILED: applicant approved themselves';
  exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ declare mid uuid; begin
  mid := approve_landlord((select id from landlord_applications where company_name = 'Template Lane Rentals'), null, 'Checked LLC filing and official site; called the office number on the site');
  perform set_config('test.mid', mid::text, false);
end $$;
reset request.jwt.claim.sub;
reset role;
update listings set property_manager_id = current_setting('test.mid')::uuid where id = 'lead-oakland-801-14th-st';

-- anon can never see applications
set role anon;
do $$ begin
  begin perform 1 from landlord_applications; raise exception 'TEST FAILED: anon read applications';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- renter opens a conversation and sends messages
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
insert into conversations(listing_id, renter_id, manager_id) values ('lead-oakland-801-14th-st', '00000000-0000-0000-0000-0000000000c3', current_setting('test.mid')::uuid);
do $$ begin
  begin
    insert into conversations(listing_id, renter_id, manager_id) values ('lead-oakland-44th-st', '00000000-0000-0000-0000-0000000000c3', current_setting('test.mid')::uuid);
    raise exception 'TEST FAILED: conversation on an unverified lead';
  exception when insufficient_privilege then null; end;
end $$;
insert into messages(conversation_id, sender_id, body) select id, '00000000-0000-0000-0000-0000000000c3', 'Hi! Call me at (510) 555-0199 or me@example.com' from conversations where listing_id = 'lead-oakland-801-14th-st';
reset request.jwt.claim.sub;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e5';  -- manager member
insert into messages(conversation_id, sender_id, body) select id, '00000000-0000-0000-0000-0000000000e5', 'Thanks — to hold it, send a $500 deposit by gift card before the tour' from conversations where listing_id = 'lead-oakland-801-14th-st';
insert into messages(conversation_id, sender_id, body) select id, '00000000-0000-0000-0000-0000000000e5', 'Tours are Saturday 10–12, see you then.' from conversations where listing_id = 'lead-oakland-801-14th-st';
reset request.jwt.claim.sub;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';  -- renter view
do $$ begin
  assert (select count(*) from messages) = 2, format('renter sees own + released message only, saw %s', (select count(*) from messages));
  assert exists (select 1 from messages where body like '%[contact hidden until a tour is confirmed]%' and masked), 'contacts masked before a tour';
  assert not exists (select 1 from messages where body ~ '555-0199' or body like '%@example.com%'), 'raw contacts not stored';
  assert not exists (select 1 from messages where body ilike '%gift card%'), 'held message hidden from recipient';
end $$;
reset request.jwt.claim.sub;
reset role;
do $$ begin
  assert exists (select 1 from messages where held and hold_reason like '%off-platform payment%' and hold_reason like '%payment before tour%'), 'payment request held with reasons';
  assert (select first_response_at is not null from conversations where listing_id = 'lead-oakland-801-14th-st'), 'first response recorded from released manager message only';
end $$;
-- after a confirmed tour, contact details may be shared
insert into viewings(conversation_id, proposed_by, starts_at, mode, status) select id, '00000000-0000-0000-0000-0000000000c3', now() + interval '2 days', 'in_person', 'confirmed' from conversations where listing_id = 'lead-oakland-801-14th-st';
insert into messages(conversation_id, sender_id, body) select id, '00000000-0000-0000-0000-0000000000c3', 'Great, my number is 510-555-0199' from conversations where listing_id = 'lead-oakland-801-14th-st';
do $$ begin
  assert exists (select 1 from messages where body = 'Great, my number is 510-555-0199' and not masked), 'contacts allowed after confirmed tour';
end $$;
select 'MESSAGING TESTS PASSED' as result;
