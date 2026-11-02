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
do $$ begin
  begin
    perform approve_landlord((select id from landlord_applications where company_name = 'Template Lane Rentals'), null, 'Checked LLC filing and official site');
    raise exception 'TEST FAILED: approved without authority checks';
  exception when check_violation then null; end;
  perform record_authority_checks((select id from landlord_applications where company_name = 'Template Lane Rentals'), jsonb_build_object(
    'contact_found_independently', jsonb_build_object('passed', true, 'note', 'Office number on templatelane.example'),
    'authority_document', jsonb_build_object('passed', true, 'note', 'Management agreement, stored privately'),
    'identity_matches', jsonb_build_object('passed', true, 'note', 'Same LLC name'),
    'properties_match', jsonb_build_object('passed', true, 'note', '800 Template Ln listed')));
end $$;
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

-- 20. v0.14: held-message review, landlord decisions, lead expiry, area search, price alerts,
--     landlord dashboard, photo pipeline, programs + reviewed edits, data export.
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000f6', 'reviewer2@test.local');
update user_profiles set role = 'reviewer' where id = '00000000-0000-0000-0000-0000000000f6';

-- 20a. Held messages
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e5';  -- manager asks for an SSN (held)
insert into messages(conversation_id, sender_id, body) select id, '00000000-0000-0000-0000-0000000000e5', 'Before we confirm, please send your SSN' from conversations where listing_id = 'lead-oakland-801-14th-st';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
do $$ begin
  begin
    perform review_held_message((select id from messages where held limit 1), 'release', 'renter says it is fine to release');
    raise exception 'TEST FAILED: non-reviewer reviewed a held message';
  exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ declare gift uuid; ssn uuid; begin
  select id into gift from messages where body ilike '%gift card%';
  select id into ssn from messages where body ilike '%SSN%';
  assert (select count(*) from held_messages) = 2, format('two held messages queued, saw %s', (select count(*) from held_messages));
  begin perform review_held_message(gift, 'release', 'ok'); raise exception 'TEST FAILED: short release reason';
  exception when raise_exception then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  begin perform review_held_message(gift, 'reject', 'obvious scam'); raise exception 'TEST FAILED: verdict language';
  exception when raise_exception then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  assert review_held_message(gift, 'reject', 'Asked for a gift-card deposit before any tour') = 'reject';
  assert review_held_message(ssn, 'release', 'Called manager: they meant the screening form on their official portal') = 'release';
  assert (select count(*) from held_messages) = 0, 'queue empty after review';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
do $$ begin
  assert exists (select 1 from messages where body ilike '%SSN%'), 'released message visible to renter';
  assert not exists (select 1 from messages where body ilike '%gift card%'), 'rejected message stays hidden';
end $$;
reset request.jwt.claim.sub;
reset role;
do $$ begin
  assert (select count(*) from audit_events where entity = 'message' and action in ('held_reject','held_release')) = 2, 'held decisions audited';
end $$;

-- 20b. Landlord: needs-info and rejection; unknown checks refused
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d4';
insert into landlord_applications(user_id, company_name, property_addresses) values ('00000000-0000-0000-0000-0000000000d4', 'Second Street Homes', array['12 Second St']);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ declare app uuid := (select id from landlord_applications where company_name = 'Second Street Homes'); begin
  begin perform record_authority_checks(app, '{"looks_legit": {"passed": true, "note": "x"}}'); raise exception 'TEST FAILED: unknown check accepted';
  exception when raise_exception then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  assert decide_landlord(app, 'needs_info', 'Please send the management agreement for 12 Second St') = 'needs_info';
  assert (select status from landlord_applications where id = app) = 'needs_info';
  assert decide_landlord(app, 'rejected', 'No proof of authority after 30 days') = 'rejected';
  begin perform decide_landlord(app, 'needs_info', 'again please'); raise exception 'TEST FAILED: decided twice';
  exception when raise_exception then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
end $$;

-- 20c. Lead expiry queue (reviewers only), most urgent first
do $$ declare prev int := -1000; r record; n int := 0; begin
  for r in select * from lead_expiry_queue() loop
    assert r.days_left >= prev, 'sorted by days left';
    prev := r.days_left; n := n + 1;
  end loop;
  assert n > 0, 'leads in the expiry queue';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
do $$ begin
  begin perform * from lead_expiry_queue(); raise exception 'TEST FAILED: non-reviewer saw expiry queue';
  exception when insufficient_privilege then null; end;
end $$;
reset request.jwt.claim.sub;
reset role;

-- 20d. Draw-an-area search: approximate pins never match; bad shapes refused
do $$ declare area jsonb := '{"type":"Polygon","coordinates":[[[-122.35,37.70],[-122.10,37.70],[-122.10,37.90],[-122.35,37.90],[-122.35,37.70]]]}';
               n_all int; n_area int; begin
  select count(*) into n_all from search_listings('PRIVATE_ROOM', true, null, null, null, 200000, 500, 'bay_area', null);
  select count(*) into n_area from search_listings('PRIVATE_ROOM', true, null, null, null, 200000, 500, 'bay_area', area);
  assert n_area <= n_all, 'area narrows results';
  assert not exists (select 1 from search_listings('PRIVATE_ROOM', true, null, null, null, 200000, 500, 'bay_area', area) d
                      where d->'location'->>'precision' not in ('rooftop','street')), 'no approximate pins inside a drawn area';
  begin
    perform search_listings('PRIVATE_ROOM', true, null, null, null, 200000, 500, null, '{"type":"Polygon","coordinates":[[[-122.3,37.7],[-122.1,37.9],[-122.1,37.7],[-122.3,37.9],[-122.3,37.7]]]}');
    raise exception 'TEST FAILED: self-intersecting area accepted';
  exception when raise_exception then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  begin
    perform search_listings('PRIVATE_ROOM', true, null, null, null, 200000, 500, null, '{"type":"Polygon","coordinates":[[[-123,36],[-120,36],[-120,39],[-123,39],[-123,36]]]}');
    raise exception 'TEST FAILED: huge area accepted';
  exception when raise_exception then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
end $$;

-- 20e. Price-change alerts for people who saved the home; respects alert preferences
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
insert into favorites(user_id, listing_id) values ('00000000-0000-0000-0000-0000000000c3', 'lead-san-jose-3641-kilo-ave-3');
reset request.jwt.claim.sub;
reset role;
update units set base_rent_cents = 85000 where listing_id = 'lead-san-jose-3641-kilo-ave-3';
do $$ begin
  assert exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-0000000000c3' and kind = 'listing_changed'
                 and title = 'Price dropped on a saved home' and channel = 'in_app' and body like '%$850'), 'price drop notified in-app';
end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
select set_alert_prefs(22, 7, -480, 3, array['deadline_reminder']);
do $$ begin
  begin perform set_alert_prefs(22, null, -480, 3, null); raise exception 'TEST FAILED: half quiet hours';
  exception when raise_exception then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  begin perform set_alert_prefs(null, null, 0, 3, array['bogus']); raise exception 'TEST FAILED: unknown alert kind';
  exception when check_violation then null; end;
end $$;
reset request.jwt.claim.sub;
reset role;
update units set base_rent_cents = 80000 where listing_id = 'lead-san-jose-3641-kilo-ave-3';
do $$ begin
  assert not exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-0000000000c3' and dedupe_key = 'pc:lead-san-jose-3641-kilo-ave-3:80000'), 'turned-off kind not sent';
  assert (select quiet_start from user_profiles where id = '00000000-0000-0000-0000-0000000000c3') = 22;
end $$;

-- 20f. Landlord dashboard + audit trail
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e5';
do $$ declare r record; begin
  select * into r from my_manager_listings() where id = 'lead-oakland-801-14th-st';
  assert r.conversations = 1 and r.tours_confirmed = 1, format('dashboard counts %s/%s', r.conversations, r.tours_confirmed);
  assert (select count(*) from listing_audit_trail('lead-oakland-801-14th-st')) >= 1, 'manager sees audit trail';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
do $$ begin
  assert (select count(*) from my_manager_listings()) = 0, 'renters manage nothing';
  begin perform * from listing_audit_trail('lead-oakland-801-14th-st'); raise exception 'TEST FAILED: renter read audit trail';
  exception when insufficient_privilege then null; end;
end $$;
reset request.jwt.claim.sub;
reset role;

-- 20g. Photo pipeline: quarantined → scanned → published; reused photos rejected
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e5';
insert into listing_photos(listing_id, manager_id, storage_path, mime, bytes, width, height, rights_attested, uploaded_by)
values ('lead-oakland-801-14th-st', current_setting('test.mid')::uuid, 'm/lead-oakland-801-14th-st/p1.jpg', 'image/jpeg', 2000000, 1600, 1200, true, '00000000-0000-0000-0000-0000000000e5');
do $$ begin
  begin
    insert into listing_photos(listing_id, manager_id, storage_path, mime, bytes, width, height, rights_attested, uploaded_by, status)
    values ('lead-oakland-801-14th-st', current_setting('test.mid')::uuid, 'm/x/p2.jpg', 'image/jpeg', 2000000, 1600, 1200, true, '00000000-0000-0000-0000-0000000000e5', 'published');
    raise exception 'TEST FAILED: uploaded straight to published';
  exception when insufficient_privilege then null; end;
  begin
    insert into listing_photos(listing_id, manager_id, storage_path, mime, bytes, width, height, rights_attested, uploaded_by)
    values ('lead-oakland-801-14th-st', current_setting('test.mid')::uuid, 'm/x/p3.jpg', 'image/jpeg', 2000000, 1600, 1200, false, '00000000-0000-0000-0000-0000000000e5');
    raise exception 'TEST FAILED: no rights attestation';
  exception when check_violation then null; end;
  begin perform publish_listing_photo((select id from listing_photos where storage_path like '%p1.jpg')); raise exception 'TEST FAILED: published before scan';
  exception when raise_exception then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  begin perform record_photo_scan((select id from listing_photos where storage_path like '%p1.jpg'), true, 'ffffffff00000000', 'ok'); raise exception 'TEST FAILED: manager recorded own scan';
  exception when insufficient_privilege then null; end;
end $$;
reset request.jwt.claim.sub;
set role anon;
do $$ begin assert (select count(*) from listing_photos) = 0, 'anon cannot see quarantined photos'; end $$;
reset role;
set role service_role;
select record_photo_scan((select id from listing_photos where storage_path like '%p1.jpg'), true, 'ffffffff00000000', 'no threats found');
reset role;
-- the same image already published on a different listing
insert into listing_photos(listing_id, manager_id, storage_path, mime, bytes, width, height, rights_attested, uploaded_by, status, dhash)
values ('lead-oakland-44th-st', current_setting('test.mid')::uuid, 'm/other/p9.jpg', 'image/jpeg', 2000000, 1600, 1200, true, '00000000-0000-0000-0000-0000000000e5', 'published', 'ffffffff00000001');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e5';
do $$ begin
  assert publish_listing_photo((select id from listing_photos where storage_path like '%p1.jpg')) = 'rejected', 'reused photo rejected';
end $$;
reset request.jwt.claim.sub;
reset role;
delete from listing_photos where storage_path = 'm/other/p9.jpg';
update listing_photos set status = 'quarantined', dhash = null where storage_path like '%p1.jpg';
set role service_role;
select record_photo_scan((select id from listing_photos where storage_path like '%p1.jpg'), true, '0123456789abcdef', 'no threats found');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e5';
do $$ begin
  assert publish_listing_photo((select id from listing_photos where storage_path like '%p1.jpg')) = 'published', 'clean original photo published';
end $$;
reset request.jwt.claim.sub;
reset role;
set role anon;
do $$ begin assert (select count(*) from listing_photos where status = 'published') = 1, 'anon sees published photo'; end $$;
reset role;

-- 20h. Programs: public read; edits need a different reviewer; only whitelisted fields
set role anon;
do $$ begin assert (select count(*) from programs) >= 6, 'programs seeded and public'; end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
insert into program_edits(program_id, proposed_by, changes, evidence_url) values ('doorway', '00000000-0000-0000-0000-0000000000c3', '{"hours":"Online 24/7"}', 'https://housingbayarea.mtc.ca.gov/');
insert into program_edits(program_id, proposed_by, changes) values ('doorway', '00000000-0000-0000-0000-0000000000c3', '{"name":"Something else"}');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
insert into program_edits(program_id, proposed_by, changes) values ('doorway', '00000000-0000-0000-0000-0000000000a1', '{"hours":"self edit"}');
do $$ begin
  assert decide_program_edit((select id from program_edits where changes->>'hours' = 'Online 24/7'), true, 'Checked the portal home page today') = 'approved';
  assert (select hours from programs where id = 'doorway') = 'Online 24/7', 'edit applied';
  assert (select checked_on from programs where id = 'doorway') = current_date, 'checked date refreshed';
  begin perform decide_program_edit((select id from program_edits where changes ? 'name'), true, 'renaming it'); raise exception 'TEST FAILED: name edited';
  exception when raise_exception then if sqlerrm like 'TEST FAILED%' then raise; end if; end;
  begin perform decide_program_edit((select id from program_edits where changes->>'hours' = 'self edit'), true, 'approving myself'); raise exception 'TEST FAILED: self-approved';
  exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f6';
do $$ begin
  assert decide_program_edit((select id from program_edits where changes->>'hours' = 'self edit'), false, 'Hours not stated on the source') = 'rejected';
end $$;

-- 20i. Download my data
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
do $$ declare d jsonb := export_my_data(); begin
  assert d->'favorites' ? 'lead-san-jose-3641-kilo-ave-3', 'favorites exported';
  assert jsonb_array_length(d->'conversations') = 1, 'conversation exported';
  assert not (d::text ilike '%gift card%'), 'rejected held message from the manager is not exported';
  assert not (d->'profile' ? 'role'), 'role not exported';
end $$;
reset request.jwt.claim.sub;
reset role;
select 'V0.14 TESTS PASSED' as result;
