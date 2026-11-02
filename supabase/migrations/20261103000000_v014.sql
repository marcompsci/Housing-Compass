-- v0.14: moderation tools, draw-an-area search, price-drop alerts, alert preferences,
-- landlord dashboard, photo pipeline, programs table, data export.
-- Each block mirrors a pure function in packages/core (tests on both sides).

-- Shared: neutral-language check for moderator reasons (mirrors core/trust/review.ts VERDICT_WORDS).
create or replace function is_verdict_language(p text) returns boolean
language sql immutable as $$
  select coalesce(p, '') ~* '\m(fraud(ulent|ster)?|scam(mer|my)?|con ?artist|criminal|liar|fake landlord)\M'
$$;

-- ───────── 1. Held-message review (core: trust/moderation.ts) ─────────
alter table messages
  add column if not exists reviewed_at     timestamptz,
  add column if not exists reviewed_by     uuid references auth.users(id),
  add column if not exists review_decision text check (review_decision in ('released','rejected')),
  add column if not exists review_reason   text;

create or replace view held_messages with (security_invoker = true) as
select m.id, m.conversation_id, m.body, m.hold_reason, m.created_at, c.listing_id, l.title as listing_title,
       (m.sender_id = c.renter_id) as from_renter
  from messages m
  join conversations c on c.id = m.conversation_id
  join listings l on l.id = c.listing_id
 where m.held and m.reviewed_at is null;
grant select on held_messages to authenticated;

create or replace function review_held_message(p_message uuid, p_decision text, p_reason text)
returns text language plpgsql security invoker set search_path = public as $$
declare m messages; c conversations;
begin
  if not is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if p_decision not in ('release', 'reject') then raise exception 'unknown decision %', p_decision; end if;
  if coalesce(length(trim(p_reason)), 0) < (case when p_decision = 'release' then 15 else 5 end) then
    raise exception 'a fuller reason is required';
  end if;
  if is_verdict_language(p_reason) then raise exception 'use neutral language: describe what was found, not a verdict'; end if;
  select * into m from messages where id = p_message and held and reviewed_at is null for update;
  if m.id is null then raise exception 'not a held message awaiting review'; end if;
  update messages
     set held = (p_decision = 'reject'), reviewed_at = now(), reviewed_by = auth.uid(),
         review_decision = case when p_decision = 'release' then 'released' else 'rejected' end, review_reason = p_reason
   where id = m.id;
  if p_decision = 'release' then
    select * into c from conversations where id = m.conversation_id;
    update conversations set first_response_at = coalesce(first_response_at, case when m.sender_id <> c.renter_id then now() end)
     where id = c.id;
  end if;
  insert into audit_events(entity, entity_id, action, actor_kind, actor_id, to_value, reason)
  values ('message', m.id::text, 'held_' || p_decision, 'human', auth.uid()::text, p_decision, p_reason);
  return p_decision;
end $$;
grant execute on function review_held_message(uuid, text, text) to authenticated;

-- ───────── 2. Landlord applications: authority checks before approval ─────────
alter table landlord_applications add column if not exists authority_checks jsonb not null default '{}'::jsonb;

create or replace function authority_checks_complete(p jsonb) returns boolean
language sql immutable as $$
  select coalesce(bool_and(coalesce((p->k->>'passed')::boolean, false) and length(trim(coalesce(p->k->>'note', ''))) >= 3), false)
    from unnest(array['contact_found_independently','authority_document','identity_matches','properties_match']) as k
$$;

create or replace function record_authority_checks(p_application uuid, p_checks jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare bad text;
begin
  if not is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if jsonb_typeof(p_checks) <> 'object' then raise exception 'checks must be an object'; end if;
  select k into bad from jsonb_object_keys(p_checks) k
   where k not in ('contact_found_independently','authority_document','identity_matches','properties_match') limit 1;
  if bad is not null then raise exception 'unknown authority check %', bad; end if;
  update landlord_applications set authority_checks = authority_checks || p_checks
   where id = p_application and status in ('open','needs_info');
  if not found then raise exception 'application not found or already decided'; end if;
  return (select authority_checks from landlord_applications where id = p_application);
end $$;
grant execute on function record_authority_checks(uuid, jsonb) to authenticated;

create or replace function approve_landlord(p_application uuid, p_manager_id uuid, p_notes text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare a landlord_applications; mid uuid := p_manager_id;
begin
  if not is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if coalesce(length(trim(p_notes)), 0) < 5 then raise exception 'reviewer notes are required'; end if;
  if is_verdict_language(p_notes) then raise exception 'use neutral language: describe what was found, not a verdict'; end if;
  select * into a from landlord_applications where id = p_application and status in ('open','needs_info');
  if a.id is null then raise exception 'application not found or already decided'; end if;
  if not authority_checks_complete(a.authority_checks) then
    raise exception 'all four authority checks must pass, each with a note, before approval' using errcode = '23514';
  end if;
  if mid is null then
    insert into property_managers(name, official_domains, official_phones, verified_at, verified_by)
    values (a.company_name,
            case when a.official_website is null then '{}' else array[lower(regexp_replace(a.official_website, '^https://(www\.)?([^/]+).*$', '\2'))] end,
            case when a.official_phone is null then '{}' else array[a.official_phone] end,
            now(), auth.uid())
    returning id into mid;
  end if;
  insert into manager_members(manager_id, user_id, approved_by) values (mid, a.user_id, auth.uid()) on conflict do nothing;
  update landlord_applications set status = 'approved', reviewer_notes = p_notes, decided_by = auth.uid(), decided_at = now() where id = a.id;
  insert into audit_events(entity, entity_id, action, actor_kind, actor_id, to_value, reason)
  values ('landlord_application', a.id::text, 'approved', 'human', auth.uid()::text, mid::text, p_notes);
  return mid;
end $$;

create or replace function decide_landlord(p_application uuid, p_decision text, p_notes text)
returns text language plpgsql security invoker set search_path = public as $$
begin
  if not is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if p_decision not in ('needs_info', 'rejected') then raise exception 'use approve_landlord to approve'; end if;
  if coalesce(length(trim(p_notes)), 0) < 5 then raise exception 'reviewer notes are required'; end if;
  if is_verdict_language(p_notes) then raise exception 'use neutral language: describe what was found, not a verdict'; end if;
  update landlord_applications
     set status = p_decision, reviewer_notes = p_notes,
         decided_by = case when p_decision = 'rejected' then auth.uid() end,
         decided_at = case when p_decision = 'rejected' then now() end
   where id = p_application and status in ('open','needs_info');
  if not found then raise exception 'application not found or already decided'; end if;
  insert into audit_events(entity, entity_id, action, actor_kind, actor_id, to_value, reason)
  values ('landlord_application', p_application::text, p_decision, 'human', auth.uid()::text, p_decision, p_notes);
  return p_decision;
end $$;
grant execute on function decide_landlord(uuid, text, text) to authenticated;

-- ───────── 3. Research leads nearing auto-expiry (core: leadExpiryQueue) ─────────
create or replace function lead_expiry_queue()
returns table(id text, title text, city text, days_left int)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  return query
  select l.id, l.title, l.city,
         (14 - floor(extract(epoch from (now() - coalesce(l.last_price_check_at, l.captured_at))) / 86400))::int
    from listings l
   where l.verification_level = 'SOURCE_LISTED_UNVERIFIED' and l.status = 'active'
     and l.intake is not null and coalesce(l.intake->>'reviewStatus', '') <> 'rejected'
   order by 4, l.city;
end $$;
grant execute on function lead_expiry_queue() to authenticated;

-- ───────── 4. Draw-an-area search ─────────
-- Approximate (city/ZIP-centroid) pins never match a drawn area; mirrors core/area.ts.
create or replace function search_area_geom(p_area jsonb) returns geometry
language plpgsql immutable as $$
declare g geometry; n int;
begin
  if p_area is null then return null; end if;
  if p_area->>'type' <> 'Polygon' then raise exception 'area must be a GeoJSON Polygon'; end if;
  n := jsonb_array_length(p_area->'coordinates'->0);
  if n < 4 or n > 21 then raise exception 'area must have 3 to 20 points'; end if;
  g := st_setsrid(st_geomfromgeojson(p_area::text), 4326);
  if not st_isvalid(g) then raise exception 'area edges cross each other'; end if;
  if st_area(g::geography) / 1e6 > 5000 then raise exception 'area is too large'; end if;
  return g;
end $$;

drop function if exists search_listings(text, boolean, double precision, double precision, double precision, int, int, text);
create or replace function search_listings(
  p_category text,
  p_include_unverified boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_max_rent_cents int default 200000,
  p_limit int default 500,
  p_region text default null,
  p_area jsonb default null
) returns setof jsonb
language plpgsql volatile security invoker set search_path = public as $$
declare area geometry := search_area_geom(p_area);
begin
  perform search_guard();
  return query
  select d.doc
    from listing_documents d
   where d.status = 'active'
     and not d.is_demo
     and d.category = p_category
     and (p_region is null or d.region = p_region or (p_region = 'la_county' and d.region = 'la_city'))
     and (d.verification_level in ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED')
          or (p_include_unverified and d.verification_level = 'SOURCE_LISTED_UNVERIFIED'))
     and coalesce(d.doc->'intake'->>'reviewStatus', '') <> 'rejected'
     and d.all_in_cents <= least(coalesce(p_max_rent_cents, 200000), 200000)
     and (p_radius_km is null or p_lat is null or
          st_dwithin(d.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000))
     and (area is null or (d.doc->'location'->>'precision' in ('rooftop','street') and st_covers(area, d.location::geometry)))
   order by d.all_in_cents
   limit least(greatest(p_limit, 1), 1000);
end $$;
grant execute on function search_listings(text, boolean, double precision, double precision, double precision, int, int, text, jsonb) to anon, authenticated;

-- ───────── 5 + 6. Alert preferences and price-change alerts ─────────
alter table user_profiles add column if not exists alert_kinds text[] not null
  default array['saved_search_match','deadline_reminder','listing_changed','listing_expired']
  check (alert_kinds <@ array['saved_search_match','deadline_reminder','listing_changed','listing_expired']);

create or replace function set_alert_prefs(p_quiet_start int, p_quiet_end int, p_utc_offset_minutes int, p_max_push_per_day int, p_kinds text[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if (p_quiet_start is null) <> (p_quiet_end is null) then raise exception 'set both quiet-hour ends or neither'; end if;
  if abs(p_utc_offset_minutes) > 840 then raise exception 'invalid time zone offset'; end if;
  update user_profiles
     set quiet_start = p_quiet_start, quiet_end = p_quiet_end, utc_offset_minutes = p_utc_offset_minutes,
         max_push_per_day = p_max_push_per_day, alert_kinds = coalesce(p_kinds, '{}'), updated_at = now()
   where id = auth.uid();
end $$;
grant execute on function set_alert_prefs(int, int, int, int, text[]) to authenticated;

-- A recorded price change notifies everyone who saved the home (in-app; never push).
create or replace function notify_price_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.old_cents is null or new.old_cents = new.new_cents then return new; end if;
  insert into notifications(user_id, kind, channel, dedupe_key, title, body, listing_id)
  select f.user_id, 'listing_changed', 'in_app', 'pc:' || new.listing_id || ':' || new.new_cents,
         case when new.new_cents < new.old_cents then 'Price dropped on a saved home' else 'Price changed on a saved home' end,
         l.title || ': now $' || to_char(new.new_cents / 100.0, 'FM999,990'),
         new.listing_id
    from favorites f
    join listings l on l.id = new.listing_id
    join user_profiles p on p.id = f.user_id
   where f.listing_id = new.listing_id and 'listing_changed' = any(p.alert_kinds) and not l.is_demo
  on conflict (user_id, dedupe_key) do nothing;
  return new;
end $$;
drop trigger if exists price_history_notify on price_history;
create trigger price_history_notify after insert on price_history for each row execute function notify_price_change();

-- ───────── 7. Landlord dashboard ─────────
create or replace function my_manager_listings()
returns table(id text, title text, status listing_status, verification_level verification_level, last_verified_at timestamptz,
              conversations bigint, awaiting_reply bigint, tours_proposed bigint, tours_confirmed bigint)
language sql stable security definer set search_path = public as $$
  select l.id, l.title, l.status, l.verification_level, l.last_verified_at,
         (select count(*) from conversations c where c.listing_id = l.id),
         (select count(*) from conversations c where c.listing_id = l.id and c.first_response_at is null),
         (select count(*) from viewings v join conversations c on c.id = v.conversation_id where c.listing_id = l.id and v.status = 'proposed'),
         (select count(*) from viewings v join conversations c on c.id = v.conversation_id where c.listing_id = l.id and v.status = 'confirmed')
    from listings l
   where l.property_manager_id in (select manager_id from manager_members where user_id = auth.uid())
   order by l.title
$$;
revoke all on function my_manager_listings() from public, anon;
grant execute on function my_manager_listings() to authenticated;

-- Change history of one listing, for its managers and reviewers only.
create or replace function listing_audit_trail(p_listing text)
returns table(at timestamptz, action text, actor_kind text, from_value text, to_value text, reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_reviewer() or exists (select 1 from listings l where l.id = p_listing and is_manager_member(l.property_manager_id))) then
    raise exception 'managers of this listing and reviewers only' using errcode = '42501';
  end if;
  return query select a.at, a.action, a.actor_kind, a.from_value, a.to_value, a.reason
    from audit_events a where a.entity = 'listing' and a.entity_id = p_listing order by a.at desc limit 200;
end $$;
revoke all on function listing_audit_trail(text) from public, anon;
grant execute on function listing_audit_trail(text) to authenticated;

-- ───────── 8. Listing photos (core: photos.ts) ─────────
create table if not exists listing_photos (
  id              uuid primary key default gen_random_uuid(),
  listing_id      text not null references listings(id) on delete cascade,
  manager_id      uuid not null references property_managers(id) on delete cascade,
  storage_path    text not null unique check (storage_path !~ '\.\.'),
  mime            text not null check (mime in ('image/jpeg','image/png','image/heic','image/webp')),
  bytes           int not null check (bytes between 1 and 10485760),
  width           int not null check (width between 400 and 8000),
  height          int not null check (height between 400 and 8000),
  dhash           char(16) check (dhash ~ '^[0-9a-f]{16}$'),
  rights_attested boolean not null check (rights_attested),
  status          text not null default 'quarantined' check (status in ('quarantined','clean','infected','rejected','published')),
  scan_detail     text,
  uploaded_by     uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  published_at    timestamptz
);
create index if not exists listing_photos_listing_idx on listing_photos (listing_id, status);
alter table listing_photos enable row level security;
-- Public sees published photos of publicly visible listings only.
create policy photos_public_read on listing_photos for select using (
  (status = 'published' and exists (select 1 from listings l where l.id = listing_id))
  or is_manager_member(manager_id) or is_reviewer());
-- Managers add photos to their own listings; everything starts quarantined.
create policy photos_member_insert on listing_photos for insert with check (
  uploaded_by = auth.uid() and is_manager_member(manager_id) and status = 'quarantined'
  and exists (select 1 from listings l where l.id = listing_id and l.property_manager_id = manager_id));
grant select, insert on listing_photos to authenticated;

create or replace function photo_limit_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from listing_photos where listing_id = new.listing_id and status <> 'rejected') >= 20 then
    raise exception 'a listing can have at most 20 photos';
  end if;
  return new;
end $$;
create trigger listing_photos_limit before insert on listing_photos for each row execute function photo_limit_guard();
grant select on listing_photos to anon;
grant select, update on listing_photos to service_role;

-- Only the scanning service (service_role) records scan results.
create or replace function record_photo_scan(p_photo uuid, p_clean boolean, p_dhash text, p_detail text)
returns text language plpgsql security definer set search_path = public as $$
begin
  update listing_photos set status = case when p_clean then 'clean' else 'infected' end,
         dhash = case when p_clean then lower(p_dhash) end, scan_detail = left(p_detail, 500)
   where id = p_photo and status = 'quarantined';
  if not found then raise exception 'photo not awaiting a scan'; end if;
  return case when p_clean then 'clean' else 'infected' end;
end $$;
revoke all on function record_photo_scan(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function record_photo_scan(uuid, boolean, text, text) to service_role;

create or replace function publish_listing_photo(p_photo uuid)
returns text language plpgsql security definer set search_path = public as $$
declare p listing_photos; dup uuid;
begin
  select * into p from listing_photos where id = p_photo;
  if p.id is null or not (is_manager_member(p.manager_id) or is_reviewer()) then raise exception 'not your photo' using errcode = '42501'; end if;
  if p.status <> 'clean' then raise exception 'photo is %, not ready to publish', p.status; end if;
  select o.id into dup from listing_photos o
   where o.listing_id <> p.listing_id and o.dhash is not null and o.status in ('clean','published')
     and bit_count(('x' || o.dhash)::bit(64) # ('x' || p.dhash)::bit(64)) <= 8 limit 1;
  if dup is not null then
    update listing_photos set status = 'rejected', scan_detail = 'same image as another listing' where id = p.id;
    insert into audit_events(entity, entity_id, action, actor_kind, actor_id, to_value, reason)
    values ('listing_photo', p.id::text, 'rejected', 'system', 'system:photo_dedupe', dup::text, 'same image appears on another listing');
    return 'rejected';
  end if;
  update listing_photos set status = 'published', published_at = now() where id = p.id;
  return 'published';
end $$;
revoke all on function publish_listing_photo(uuid) from public, anon;
grant execute on function publish_listing_photo(uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public) values ('listing-photos-quarantine', 'listing-photos-quarantine', false) on conflict (id) do nothing;
  end if;
end $$;

-- ───────── 9. Official programs as data, with reviewed edits ─────────
create table if not exists programs (
  id               text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  regions          text[] not null check (regions <@ array['bay_area','la_city','la_county'] and cardinality(regions) > 0),
  name             text not null,
  operator         text not null,
  kind             text not null check (kind in ('affordable_portal','accessible_registry','property_map','resource_center','referral_line')),
  url              text not null check (url ~ '^https://'),
  phone            text,
  tty              text,
  hours            text,
  what_it_is       text not null,
  waitlist_info    text not null,
  eligibility_info text not null,
  vacancy_info     text not null,
  checked_on       date not null,
  sources          text[] not null default '{}',
  status           text not null default 'published' check (status in ('published','retired')),
  updated_at       timestamptz not null default now()
);
alter table programs enable row level security;
create policy programs_read on programs for select using (status = 'published' or is_reviewer());
create policy programs_write on programs for all using (is_reviewer()) with check (is_reviewer());
grant select on programs to anon, authenticated;
grant insert, update on programs to authenticated;

create table if not exists program_edits (
  id          uuid primary key default gen_random_uuid(),
  program_id  text not null references programs(id) on delete cascade,
  proposed_by uuid not null references auth.users(id) on delete cascade,
  changes     jsonb not null check (jsonb_typeof(changes) = 'object'),
  evidence_url text check (evidence_url ~ '^https://'),
  status      text not null default 'open' check (status in ('open','approved','rejected')),
  decided_by  uuid references auth.users(id),
  decided_at  timestamptz,
  reason      text,
  created_at  timestamptz not null default now()
);
alter table program_edits enable row level security;
create policy program_edits_insert on program_edits for insert with check (proposed_by = auth.uid() and status = 'open');
create policy program_edits_read on program_edits for select using (proposed_by = auth.uid() or is_reviewer());
create policy program_edits_review on program_edits for update using (is_reviewer()) with check (is_reviewer());
grant select, insert, update on program_edits to authenticated;

create or replace function decide_program_edit(p_edit uuid, p_approve boolean, p_reason text)
returns text language plpgsql security invoker set search_path = public as $$
declare e program_edits; k text;
begin
  if not is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'a reason is required'; end if;
  select * into e from program_edits where id = p_edit and status = 'open' for update;
  if e.id is null then raise exception 'edit not found or already decided'; end if;
  if e.proposed_by = auth.uid() then raise exception 'a different reviewer must decide your own edit' using errcode = '42501'; end if;
  if p_approve then
    for k in select jsonb_object_keys(e.changes) loop
      if k not in ('url','phone','tty','hours','what_it_is','waitlist_info','eligibility_info','vacancy_info') then
        raise exception 'field % cannot be changed through an edit', k;
      end if;
    end loop;
    update programs set
      url = coalesce(e.changes->>'url', url), phone = coalesce(e.changes->>'phone', phone), tty = coalesce(e.changes->>'tty', tty),
      hours = coalesce(e.changes->>'hours', hours), what_it_is = coalesce(e.changes->>'what_it_is', what_it_is),
      waitlist_info = coalesce(e.changes->>'waitlist_info', waitlist_info), eligibility_info = coalesce(e.changes->>'eligibility_info', eligibility_info),
      vacancy_info = coalesce(e.changes->>'vacancy_info', vacancy_info),
      sources = case when e.evidence_url is null then sources else array(select distinct unnest(sources || e.evidence_url)) end,
      checked_on = current_date, updated_at = now()
     where id = e.program_id;
  end if;
  update program_edits set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now(), reason = p_reason where id = e.id;
  insert into audit_events(entity, entity_id, action, actor_kind, actor_id, to_value, reason)
  values ('program', e.program_id, case when p_approve then 'edit_approved' else 'edit_rejected' end, 'human', auth.uid()::text, e.id::text, p_reason);
  return case when p_approve then 'approved' else 'rejected' end;
end $$;
grant execute on function decide_program_edit(uuid, boolean, text) to authenticated;

-- ───────── 10. Download my data ─────────
create or replace function export_my_data() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'role' from user_profiles p where p.id = uid),
    'favorites', coalesce((select jsonb_agg(f.listing_id) from favorites f where f.user_id = uid), '[]'),
    'saved_searches', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id') from saved_searches s where s.user_id = uid), '[]'),
    'applications', coalesce((select jsonb_agg(to_jsonb(a) - 'user_id') from applications a where a.user_id = uid), '[]'),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'title', n.title, 'body', n.body, 'created_at', n.created_at)) from notifications n where n.user_id = uid), '[]'),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('listing_id', r.listing_id, 'reason', r.reason, 'details', r.details, 'status', r.status, 'created_at', r.created_at)) from reports r where r.reporter_id = uid), '[]'),
    'conversations', coalesce((select jsonb_agg(jsonb_build_object(
        'listing_id', c.listing_id, 'created_at', c.created_at,
        'messages', (select coalesce(jsonb_agg(jsonb_build_object('mine', m.sender_id = uid, 'body', m.body, 'held', m.held, 'at', m.created_at) order by m.created_at), '[]')
                       from messages m where m.conversation_id = c.id and (m.sender_id = uid or not m.held))))
        from conversations c where c.renter_id = uid), '[]'),
    'landlord_applications', coalesce((select jsonb_agg(jsonb_build_object('company_name', a.company_name, 'status', a.status, 'created_at', a.created_at)) from landlord_applications a where a.user_id = uid), '[]')
  );
end $$;
revoke all on function export_my_data() from public, anon;
grant execute on function export_my_data() to authenticated;
