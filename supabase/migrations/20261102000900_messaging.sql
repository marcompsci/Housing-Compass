-- Landlord onboarding, in-app messaging with masked contacts, tour requests, response metrics.

-- ───────── Landlord / manager onboarding ─────────
-- Proof of authority is reviewed by a moderator. Documents live in the PRIVATE 'evidence'
-- bucket (paths only here) and are never exposed publicly.
create table landlord_applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  company_name     text not null check (char_length(company_name) between 2 and 120),
  official_website text check (official_website ~* '^https://'),
  official_phone   text,
  property_addresses text[] not null default '{}',
  evidence_paths   text[] not null default '{}',
  status           text not null default 'open' check (status in ('open','approved','rejected','needs_info')),
  reviewer_notes   text,
  decided_by       uuid references auth.users(id),
  decided_at       timestamptz,
  created_at       timestamptz not null default now()
);
alter table landlord_applications enable row level security;
create policy la_own_insert on landlord_applications for insert with check (user_id = auth.uid() and status = 'open');
create policy la_own_read on landlord_applications for select using (user_id = auth.uid() or is_reviewer());
create policy la_review on landlord_applications for update using (is_reviewer()) with check (is_reviewer());
grant select, insert, update on landlord_applications to authenticated;

create table manager_members (
  manager_id  uuid not null references property_managers(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  primary key (manager_id, user_id)
);
alter table manager_members enable row level security;
create policy mm_read on manager_members for select using (user_id = auth.uid() or is_reviewer());
create policy mm_write on manager_members for all using (is_reviewer()) with check (is_reviewer());
grant select, insert, delete on manager_members to authenticated;

create or replace function is_manager_member(p_manager uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from manager_members where manager_id = p_manager and user_id = auth.uid());
$$;

create or replace function approve_landlord(p_application uuid, p_manager_id uuid, p_notes text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare a landlord_applications; mid uuid := p_manager_id;
begin
  if not is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  select * into a from landlord_applications where id = p_application and status in ('open','needs_info');
  if a.id is null then raise exception 'application not found or already decided'; end if;
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
grant execute on function approve_landlord(uuid, uuid, text) to authenticated;

-- ───────── Conversations, messages, tours ─────────
create table conversations (
  id                uuid primary key default gen_random_uuid(),
  listing_id        text not null references listings(id) on delete cascade,
  renter_id         uuid not null references auth.users(id) on delete cascade,
  manager_id        uuid not null references property_managers(id) on delete cascade,
  status            text not null default 'open' check (status in ('open','closed','blocked')),
  created_at        timestamptz not null default now(),
  last_message_at   timestamptz,
  first_response_at timestamptz,
  unique (listing_id, renter_id)
);
create index conversations_manager_idx on conversations (manager_id, last_message_at desc);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 2000),
  held            boolean not null default false,
  hold_reason     text,
  masked          boolean not null default false,
  created_at      timestamptz not null default now()
);
create index messages_conv_idx on messages (conversation_id, created_at);

create table viewings (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  proposed_by     uuid not null references auth.users(id),
  starts_at       timestamptz not null,
  mode            text not null check (mode in ('in_person','live_video')),
  status          text not null default 'proposed' check (status in ('proposed','confirmed','declined','cancelled','completed')),
  created_at      timestamptz not null default now()
);

create or replace function is_participant(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversations c where c.id = p_conv and (c.renter_id = auth.uid() or is_manager_member(c.manager_id)));
$$;

alter table conversations enable row level security;
alter table messages enable row level security;
alter table viewings enable row level security;

create policy conv_read on conversations for select using (renter_id = auth.uid() or is_manager_member(manager_id) or is_reviewer());
-- Renters open conversations only on listings that have a verified manager account behind them.
create policy conv_open on conversations for insert with check (
  renter_id = auth.uid()
  and exists (select 1 from listings l where l.id = listing_id and l.property_manager_id = manager_id
              and l.verification_level in ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED') and l.status = 'active'));
create policy conv_update on conversations for update using (is_participant(id)) with check (is_participant(id));

-- Held messages are visible only to their sender and reviewers until released.
create policy msg_read on messages for select using ((is_participant(conversation_id) and (not held or sender_id = auth.uid())) or is_reviewer());
create policy msg_send on messages for insert with check (sender_id = auth.uid() and is_participant(conversation_id) and not held);
create policy msg_review on messages for update using (is_reviewer()) with check (is_reviewer());

create policy view_read on viewings for select using (is_participant(conversation_id) or is_reviewer());
create policy view_propose on viewings for insert with check (proposed_by = auth.uid() and is_participant(conversation_id) and status = 'proposed');
create policy view_update on viewings for update using (is_participant(conversation_id)) with check (is_participant(conversation_id));

grant select, insert, update on conversations, messages, viewings to authenticated;

-- Guard: rate limits, contact masking before a confirmed tour, holds for payment / sensitive-data requests.
-- Mirrors packages/core/src/trust/messageGuard.ts (parity is tested on both sides).
create or replace function message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare confirmed boolean; reasons text[] := '{}';
begin
  if not hit_rate_limit('msg:' || new.sender_id, 30, 3600) then
    raise exception 'You are sending messages too quickly. Please wait a bit.' using errcode = 'P0429';
  end if;
  select exists (select 1 from viewings v where v.conversation_id = new.conversation_id and v.status = 'confirmed') into confirmed;
  if not confirmed then
    if new.body ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' or new.body ~ '(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}' or new.body ~* '(https?://|www\.)\S+' then
      new.body := regexp_replace(new.body, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact hidden until a tour is confirmed]', 'g');
      new.body := regexp_replace(new.body, '(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}', '[contact hidden until a tour is confirmed]', 'g');
      new.body := regexp_replace(new.body, '(https?://|www\.)\S+', '[link hidden until a tour is confirmed]', 'gi');
      new.masked := true;
    end if;
  end if;
  if new.body ~* '\m(wire( transfer)?|western union|moneygram|gift ?cards?|bitcoin|crypto(currency)?|usdt)\M' then reasons := array_append(reasons, 'off-platform payment'); end if;
  if new.body ~* '(paypal\.me|venmo\.com/|cash\.app/)' then reasons := array_append(reasons, 'payment link'); end if;
  if new.body ~* '\m(deposit|payment|pay|fee)\M.{0,60}\m(before|prior to)\M.{0,30}\m(tour|viewing|showing|see|seeing|visit)' then reasons := array_append(reasons, 'payment before tour'); end if;
  if new.body ~* '\m(ssn|social security( number)?|bank (login|password)|routing number)\M' then reasons := array_append(reasons, 'sensitive personal data request'); end if;
  if array_length(reasons, 1) > 0 then
    new.held := true;
    new.hold_reason := array_to_string(reasons, ', ');
  end if;
  return new;
end $$;
create trigger messages_guard before insert on messages for each row execute function message_guard();

-- RLS insert check runs on the row AFTER before-triggers; allow guard-held rows from participants.
drop policy msg_send on messages;
create policy msg_send on messages for insert with check (sender_id = auth.uid() and is_participant(conversation_id));

create or replace function conversation_open_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not hit_rate_limit('conv:' || new.renter_id, 10, 86400) then
    raise exception 'You can start up to 10 new conversations a day.' using errcode = 'P0429';
  end if;
  return new;
end $$;
create trigger conversations_open_guard before insert on conversations for each row execute function conversation_open_guard();

create or replace function message_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare c conversations;
begin
  select * into c from conversations where id = new.conversation_id;
  update conversations set last_message_at = new.created_at,
         first_response_at = coalesce(first_response_at, case when new.sender_id <> c.renter_id and not new.held then new.created_at end)
   where id = new.conversation_id;
  return new;
end $$;
create trigger messages_after after insert on messages for each row execute function message_after();

-- Public response metrics per manager (aggregate only; shown when there are ≥5 conversations).
create or replace view manager_response_stats with (security_invoker = false) as
select manager_id,
       count(*) as conversations,
       round(100.0 * count(first_response_at) / nullif(count(*), 0)) as reply_rate_pct,
       percentile_cont(0.5) within group (order by extract(epoch from (first_response_at - created_at)) / 3600.0)
         filter (where first_response_at is not null) as median_reply_hours
  from conversations
 where created_at > now() - interval '90 days'
 group by manager_id
having count(*) >= 5;
grant select on manager_response_stats to anon, authenticated;
