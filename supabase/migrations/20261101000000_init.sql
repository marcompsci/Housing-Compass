-- Housing Compass — initial schema
-- Postgres 15+ / Supabase. Requires PostGIS.
-- Trust rules are enforced HERE as well as in app code, so a buggy client or a
-- compromised API key cannot mark a listing verified without evidence.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ───────────────────────── enums ─────────────────────────
create type verification_level as enum ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED','SOURCE_LISTED_UNVERIFIED','FLAGGED','EXPIRED');
create type listing_status     as enum ('active','pending_review','expired','leased','removed');
create type source_kind        as enum ('official_portal','official_referral','property_manager','aggregator','research_import','demo_fixture');
create type price_basis        as enum ('PER_BED','PER_ROOM','PER_UNIT');
create type price_qualifier    as enum ('EXACT','STARTING_AT','RANGE');
create type unit_type          as enum ('bed_in_shared_room','room_in_shared_home','coliving_room','studio','one_bedroom','two_plus_bedroom');
create type location_precision as enum ('rooftop','street','city_approx');
create type verification_check as enum ('authorization_to_rent','address','unit_availability','rent','contact_channel','fees');
create type program_type       as enum ('lottery','waitlist','first_come_first_served','market');
create type pet_policy         as enum ('allowed','cats_only','dogs_only','not_allowed');
create type user_role          as enum ('user','reviewer','admin');
create type report_reason      as enum ('upfront_payment','off_platform_payment','not_available','wrong_price','impersonation','duplicate','discrimination','other');
create type report_status      as enum ('open','triaged','actioned','dismissed');
create type application_status as enum ('interested','applied','lottery_entered','waitlisted','interview','offered','leased','declined','withdrawn');
create type notification_status as enum ('queued','sending','sent','failed','cancelled');
create type notification_channel as enum ('push','email','in_app');

-- ───────────────────────── people & roles ─────────────────────────
create table user_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text check (char_length(display_name) <= 80),
  role          user_role not null default 'user',
  -- Only a coarse home area is kept (city name), never a device location.
  home_area     text check (char_length(home_area) <= 80),
  budget        jsonb not null default '{"roomMinCents":50000,"roomMaxCents":140000,"unitPreferredMaxCents":140000,"unitHardMaxCents":200000}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint hard_max_ceiling check ((budget->>'unitHardMaxCents')::int <= 200000)
);

create or replace function is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_profiles where id = auth.uid() and role in ('reviewer','admin'));
$$;

-- ───────────────────────── sources & managers ─────────────────────────
create table sources (
  id               text primary key,             -- 'doorway', 'zillow', 'research-2026-11-01'
  name             text not null,
  kind             source_kind not null,
  home_url         text not null,
  terms_url        text,
  can_ingest       boolean not null default false,
  can_link_out     boolean not null default true,
  legal_basis      text not null,                -- why we may use it (or why we may not)
  ingest_blocked_by text,
  authorization_ref text,                        -- e.g. signed data-sharing agreement id
  created_at       timestamptz not null default now(),
  constraint ingest_needs_basis check (not can_ingest or kind in ('research_import','property_manager','demo_fixture') or authorization_ref is not null)
);

create table property_managers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  aliases          text[] not null default '{}',
  official_domains text[] not null default '{}',
  official_phones  text[] not null default '{}',   -- E.164
  license_number   text,
  verified_at      timestamptz,
  verified_by      uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

-- ───────────────────────── listings & units ─────────────────────────
-- A listing is one advertised opportunity at one property; units hold prices.
create table listings (
  id                 text primary key,
  is_demo            boolean not null default false,
  title              text not null,
  property_name      text,
  property_manager_id uuid references property_managers(id),
  address_line1      text not null,
  address_unit       text,
  city               text not null,
  state              char(2) not null default 'CA',
  zip                text check (zip ~ '^\d{5}$'),
  county             text,
  location           geography(Point, 4326) not null,
  location_precision location_precision not null,
  program_type       program_type,
  income_restricted  boolean not null default false,
  application_deadline timestamptz,
  eligibility_notes  text,
  description        text,
  image_hashes       text[] not null default '{}',
  transit            jsonb,                      -- [{name, mode, walkMinutes}]
  contact_channel    text check (contact_channel in ('official_portal','phone','email','web_form','source_site')),
  contact_value      text,
  contact_independently_confirmed boolean not null default false,
  -- provenance
  source_id          text not null references sources(id),
  listing_url        text,
  search_page_urls   text[] not null default '{}',
  source_listing_id  text,
  captured_at        timestamptz not null,
  last_price_check_at timestamptz,
  -- trust
  verification_level verification_level not null default 'SOURCE_LISTED_UNVERIFIED',
  last_verified_at   timestamptz,
  verified_by        uuid references auth.users(id),
  status             listing_status not null default 'active',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint demo_titles check (not is_demo or title ilike 'DEMO%'),
  constraint verified_has_time check (verification_level not in ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED') or last_verified_at is not null),
  constraint hidden_levels_not_active check (verification_level not in ('FLAGGED','EXPIRED') or status <> 'active'),
  unique (source_id, source_listing_id)
);
create index listings_location_gix on listings using gist (location);
create index listings_public_idx on listings (verification_level, status) where not is_demo;
create index listings_city_idx on listings (lower(city));

create table units (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          text not null references listings(id) on delete cascade,
  unit_type           unit_type not null,
  is_entire_unit      boolean not null,
  bedrooms            smallint check (bedrooms >= 0),
  bathrooms           numeric(3,1) check (bathrooms >= 0),
  sqft                int check (sqft > 0),
  household_bedrooms  smallint check (household_bedrooms > 0),
  unit_type_confirmed boolean not null default false,
  price_basis         price_basis not null,
  basis_confirmed     boolean not null default false,
  price_qualifier     price_qualifier not null default 'EXACT',
  base_rent_cents     int not null check (base_rent_cents >= 0),
  base_rent_max_cents int check (base_rent_max_cents >= base_rent_cents),
  recurring_fees      jsonb,          -- null = not confirmed; [{label, amountCents}]
  utilities_included  boolean,
  deposit_cents       int check (deposit_cents >= 0),
  move_in_costs       jsonb,          -- null = not confirmed
  concessions         text,
  pets                pet_policy,
  furnished           boolean,
  accessibility       text[],
  parking             boolean,
  min_lease_months    smallint check (min_lease_months > 0),
  move_in_date        date,
  ami_percent         smallint check (ami_percent between 1 and 200),
  income_limits       jsonb,          -- [{householdSize, maxAnnualIncomeCents}]
  min_income_multiple numeric(3,1),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Never mix per-bed pricing with entire-unit prices.
  constraint basis_matches_unit check ((is_entire_unit and price_basis = 'PER_UNIT') or (not is_entire_unit and price_basis <> 'PER_UNIT')),
  constraint bed_is_per_bed check (unit_type <> 'bed_in_shared_room' or price_basis = 'PER_BED')
);
create index units_listing_idx on units (listing_id);
create index units_rent_idx on units (price_basis, base_rent_cents);

-- ───────────────────────── verification ─────────────────────────
create table verification_evidence (
  id               uuid primary key default gen_random_uuid(),
  listing_id       text not null references listings(id) on delete cascade,
  check_type       verification_check not null,
  passed           boolean not null,
  evidence_kind    text not null check (evidence_kind in ('document','phone_call','email','site_visit','official_record','tour')),
  -- path in the private 'evidence' Storage bucket; never public
  storage_path     text,
  independent_source text,   -- where the reviewer found the contact (official site, county records…)
  notes            text,
  collected_by     uuid not null references auth.users(id),
  collected_at     timestamptz not null default now()
);
create index evidence_listing_idx on verification_evidence (listing_id, check_type);

create table listing_checks (
  id          uuid primary key default gen_random_uuid(),
  listing_id  text not null references listings(id) on delete cascade,
  check_kind  text not null check (check_kind in ('price_check','availability_check','link_check','staleness','risk_scan','manager_verification','source_recheck')),
  outcome     text not null check (outcome in ('pass','fail','changed','error','hold')),
  details     jsonb not null default '{}',
  actor_kind  text not null check (actor_kind in ('human','system')),
  actor_id    text not null,
  checked_at  timestamptz not null default now()
);
create index listing_checks_idx on listing_checks (listing_id, checked_at desc);

-- ───────────────────────── user data ─────────────────────────
create table saved_searches (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null check (char_length(name) <= 80),
  filters         jsonb not null,
  alerts_enabled  boolean not null default false,
  alert_frequency text not null default 'daily' check (alert_frequency in ('instant','daily','weekly')),
  last_alerted_at timestamptz,
  created_at      timestamptz not null default now()
);

create table favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  listing_id text not null references listings(id) on delete cascade,
  note       text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table reports (
  id           uuid primary key default gen_random_uuid(),
  listing_id   text not null references listings(id) on delete cascade,
  reporter_id  uuid not null references auth.users(id) on delete cascade,
  reason       report_reason not null,
  details      text check (char_length(details) <= 2000),
  status       report_status not null default 'open',
  resolution   text,
  resolved_by  uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index reports_open_idx on reports (status, created_at) where status = 'open';

create table appeals (
  id           uuid primary key default gen_random_uuid(),
  listing_id   text not null references listings(id) on delete cascade,
  appellant_id uuid not null references auth.users(id) on delete cascade,
  statement    text not null check (char_length(statement) between 10 and 2000),
  status       report_status not null default 'open',
  decision     text,
  decided_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);

create table applications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  listing_id     text references listings(id) on delete set null,
  unit_id        uuid references units(id) on delete set null,
  status         application_status not null default 'interested',
  applied_at     timestamptz,
  deadline       timestamptz,
  next_action    text check (char_length(next_action) <= 200),
  next_action_at timestamptz,
  notes          text check (char_length(notes) <= 4000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('saved_search_match','deadline_reminder','listing_changed','listing_expired','report_update','appeal_update')),
  channel       notification_channel not null default 'in_app',
  payload       jsonb not null default '{}',
  dedupe_key    text not null,
  status        notification_status not null default 'queued',
  scheduled_for timestamptz not null default now(),
  attempts      smallint not null default 0,
  last_error    text,
  sent_at       timestamptz,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_queue_idx on notifications (status, scheduled_for) where status = 'queued';

create table audit_events (
  id          bigint generated always as identity primary key,
  entity      text not null,
  entity_id   text not null,
  action      text not null,
  actor_kind  text not null check (actor_kind in ('human','system')),
  actor_id    text not null,
  from_value  text,
  to_value    text,
  reason      text,
  at          timestamptz not null default now()
);
create index audit_entity_idx on audit_events (entity, entity_id, at desc);

-- ───────────────────────── trust enforcement ─────────────────────────
create or replace function current_actor() returns table(kind text, id text)
language sql stable as $$
  select case when auth.uid() is null then 'system' else 'human' end,
         coalesce(auth.uid()::text, coalesce(current_setting('app.actor', true), current_user));
$$;

create or replace function enforce_listing_trust() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  src_kind source_kind;
  missing int;
  a record;
begin
  select kind into src_kind from sources where id = new.source_id;

  if new.verification_level = 'OFFICIAL_PORTAL' and src_kind not in ('official_portal','demo_fixture') then
    raise exception 'OFFICIAL_PORTAL requires an official portal source (got %)', src_kind using errcode = 'check_violation';
  end if;

  if new.verification_level = 'PROPERTY_MANAGER_VERIFIED'
     and (tg_op = 'INSERT' or old.verification_level is distinct from new.verification_level)
     and not new.is_demo then
    select count(*) into missing
      from unnest(enum_range(null::verification_check)) c
     where not exists (select 1 from verification_evidence e where e.listing_id = new.id and e.check_type = c and e.passed);
    if missing > 0 then
      raise exception 'PROPERTY_MANAGER_VERIFIED requires passing evidence for all 6 checks (% missing)', missing using errcode = 'check_violation';
    end if;
  end if;

  -- Automation (no signed-in user, not service-level review) may hide but never vouch.
  if tg_op = 'UPDATE' and old.verification_level is distinct from new.verification_level
     and auth.uid() is null and coalesce(current_setting('app.actor_kind', true), 'system') = 'system'
     and new.verification_level in ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED')
     and coalesce(current_setting('app.official_sync', true), 'off') <> 'on' then
    raise exception 'Automated actors cannot verify listings' using errcode = 'insufficient_privilege';
  end if;

  if new.verification_level in ('FLAGGED') then new.status := case when new.status = 'removed' then 'removed' else 'pending_review' end; end if;
  if new.verification_level in ('EXPIRED') and new.status = 'active' then new.status := 'expired'; end if;
  new.updated_at := now();
  return new;
end $$;

create trigger listings_trust before insert or update on listings
  for each row execute function enforce_listing_trust();

create or replace function audit_listing_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from current_actor();
  if tg_op = 'INSERT' then
    insert into audit_events(entity, entity_id, action, actor_kind, actor_id, to_value, reason)
    values ('listing', new.id, 'created', a.kind, a.id, new.verification_level::text, 'source=' || new.source_id);
  else
    if old.verification_level is distinct from new.verification_level then
      insert into audit_events(entity, entity_id, action, actor_kind, actor_id, from_value, to_value, reason)
      values ('listing', new.id, 'verification_change', a.kind, a.id, old.verification_level::text, new.verification_level::text, current_setting('app.reason', true));
    end if;
    if old.status is distinct from new.status then
      insert into audit_events(entity, entity_id, action, actor_kind, actor_id, from_value, to_value, reason)
      values ('listing', new.id, 'status_change', a.kind, a.id, old.status::text, new.status::text, current_setting('app.reason', true));
    end if;
  end if;
  return new;
end $$;

create trigger listings_audit after insert or update on listings
  for each row execute function audit_listing_change();

-- audit log is append-only
create or replace function deny_mutation() returns trigger language plpgsql as $$
begin raise exception 'audit_events is append-only'; end $$;
create trigger audit_events_immutable before update or delete on audit_events
  for each row execute function deny_mutation();

-- Scheduled job (pg_cron, every hour): hide stale listings until re-verified.
create or replace function expire_stale_listings(stale_after interval default interval '14 days')
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform set_config('app.reason', 'auto-expired: not rechecked within ' || stale_after::text, true);
  update listings set verification_level = 'EXPIRED', status = 'expired'
   where verification_level in ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED','SOURCE_LISTED_UNVERIFIED')
     and (
       coalesce(last_verified_at, last_price_check_at, captured_at) < now() - stale_after
       or (application_deadline is not null and application_deadline < now())
     );
  get diagnostics n = row_count;
  return n;
end $$;

-- Spam control: max 10 reports and 3 appeals per user per hour.
create or replace function rate_limit_user_rows() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; lim int; uid uuid;
begin
  if tg_table_name = 'reports' then uid := new.reporter_id; lim := 10;
    select count(*) into n from reports where reporter_id = uid and created_at > now() - interval '1 hour';
  else uid := new.appellant_id; lim := 3;
    select count(*) into n from appeals where appellant_id = uid and created_at > now() - interval '1 hour';
  end if;
  if n >= lim then raise exception 'Rate limit exceeded' using errcode = 'P0429'; end if;
  return new;
end $$;
create trigger reports_rate_limit before insert on reports for each row execute function rate_limit_user_rows();
create trigger appeals_rate_limit before insert on appeals for each row execute function rate_limit_user_rows();

-- A report with a payment-risk reason holds the listing for human review. Never "fraud".
create or replace function report_holds_listing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reason in ('upfront_payment','off_platform_payment','impersonation') then
    perform set_config('app.reason', 'user report: ' || new.reason::text, true);
    update listings set verification_level = 'FLAGGED'
     where id = new.listing_id and verification_level <> 'FLAGGED';
  end if;
  return new;
end $$;
create trigger reports_hold after insert on reports for each row execute function report_holds_listing();

-- ───────────────────────── public read model ─────────────────────────
create view public_listings with (security_invoker = true) as
  select l.*, st_y(l.location::geometry) as lat, st_x(l.location::geometry) as lng
    from listings l
   where l.status = 'active'
     and l.verification_level in ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED','SOURCE_LISTED_UNVERIFIED')
     and not l.is_demo;

-- ───────────────────────── row level security ─────────────────────────
alter table user_profiles        enable row level security;
alter table sources              enable row level security;
alter table property_managers    enable row level security;
alter table listings             enable row level security;
alter table units                enable row level security;
alter table verification_evidence enable row level security;
alter table listing_checks       enable row level security;
alter table saved_searches       enable row level security;
alter table favorites            enable row level security;
alter table reports              enable row level security;
alter table appeals              enable row level security;
alter table applications         enable row level security;
alter table notifications        enable row level security;
alter table audit_events         enable row level security;

-- profiles: own row; role cannot be self-elevated
create policy profiles_self_read   on user_profiles for select using (id = auth.uid() or is_reviewer());
create policy profiles_self_insert on user_profiles for insert with check (id = auth.uid() and role = 'user');
create policy profiles_self_update on user_profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from user_profiles p where p.id = auth.uid()));

-- sources: public read (shown in the app's data-source matrix)
create policy sources_read on sources for select using (true);
create policy sources_admin on sources for all using (is_reviewer()) with check (is_reviewer());

create policy managers_read on property_managers for select using (true);
create policy managers_write on property_managers for all using (is_reviewer()) with check (is_reviewer());

-- listings: public sees active official/verified/unverified (the app hides unverified unless opted in);
-- flagged / expired / demo only for reviewers
create policy listings_public_read on listings for select
  using ((status = 'active' and verification_level in ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED','SOURCE_LISTED_UNVERIFIED') and not is_demo) or is_reviewer());
create policy listings_review_write on listings for all using (is_reviewer()) with check (is_reviewer());

create policy units_public_read on units for select
  using (exists (select 1 from listings l where l.id = units.listing_id));  -- inherits listings RLS
create policy units_review_write on units for all using (is_reviewer()) with check (is_reviewer());

create policy evidence_reviewers on verification_evidence for all using (is_reviewer()) with check (is_reviewer() and collected_by = auth.uid());
create policy checks_reviewers   on listing_checks for all using (is_reviewer()) with check (is_reviewer());

create policy saved_searches_own on saved_searches for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy favorites_own      on favorites      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy applications_own   on applications   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_read on notifications for select using (user_id = auth.uid());
create policy notifications_own_mark on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reports_insert on reports for insert with check (reporter_id = auth.uid() and status = 'open');
create policy reports_read   on reports for select using (reporter_id = auth.uid() or is_reviewer());
create policy reports_review on reports for update using (is_reviewer()) with check (is_reviewer());

create policy appeals_insert on appeals for insert with check (appellant_id = auth.uid() and status = 'open');
create policy appeals_read   on appeals for select using (appellant_id = auth.uid() or is_reviewer());
create policy appeals_review on appeals for update using (is_reviewer()) with check (is_reviewer());

create policy audit_reviewers_read on audit_events for select using (is_reviewer());

-- Least privilege: anon may only read; writes need a signed-in user.
revoke all on all tables in schema public from anon;
grant select on sources, property_managers, listings, units, public_listings to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on audit_events from authenticated;
