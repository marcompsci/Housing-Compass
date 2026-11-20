-- v0.15: "no longer available" alerts, manager edit requests with review. Mirrors
-- packages/core/src/managerEdits.ts (validateEditRequest / editToDb).

-- ───────── Status-change alerts: a saved home was rented, removed, put under review or expired ─────────
create or replace function notify_listing_hidden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_demo then return new; end if;
  if (old.status = 'active' and new.status <> 'active')
     or (old.verification_level not in ('FLAGGED','EXPIRED') and new.verification_level in ('FLAGGED','EXPIRED')) then
    insert into notifications(user_id, kind, channel, dedupe_key, title, body, listing_id)
    select f.user_id, 'listing_expired', 'in_app', 'hidden:' || new.id || ':' || to_char(now(), 'YYYYMMDD'),
           case when new.status = 'leased' then 'A saved home was rented' else 'A saved home is no longer shown' end,
           new.title || case
             when new.status = 'leased' then ' is no longer available.'
             when new.verification_level = 'FLAGGED' then ' is hidden while a person reviews it (not a finding of fraud).'
             else ' expired or was removed. It returns if it''s checked again.' end,
           new.id
      from favorites f join user_profiles p on p.id = f.user_id
     where f.listing_id = new.id and 'listing_expired' = any(p.alert_kinds)
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists listings_notify_hidden on listings;
create trigger listings_notify_hidden after update of status, verification_level on listings
  for each row execute function notify_listing_hidden();

-- ───────── Manager edit requests ─────────
create table if not exists listing_edit_requests (
  id           uuid primary key default gen_random_uuid(),
  listing_id   text not null references listings(id) on delete cascade,
  manager_id   uuid not null references property_managers(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  changes      jsonb not null check (jsonb_typeof(changes) = 'object'),
  note         text not null check (char_length(note) between 5 and 500),
  status       text not null default 'open' check (status in ('open','approved','rejected','withdrawn')),
  decided_by   uuid references auth.users(id),
  decided_at   timestamptz,
  reason       text,
  created_at   timestamptz not null default now()
);
create index if not exists listing_edit_requests_open_idx on listing_edit_requests (status, created_at) where status = 'open';
alter table listing_edit_requests enable row level security;
create policy ler_read on listing_edit_requests for select using (is_manager_member(manager_id) or is_reviewer());
grant select on listing_edit_requests to authenticated;

create or replace function request_listing_edit(p_listing text, p_changes jsonb, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare l listings; k text; v jsonb; rid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into l from listings where id = p_listing;
  if l.id is null or l.property_manager_id is null or not is_manager_member(l.property_manager_id) then
    raise exception 'only this listing''s verified manager can request changes' using errcode = '42501';
  end if;
  if l.status <> 'active' then raise exception 'only active listings can be edited'; end if;
  if coalesce(length(trim(p_note)), 0) < 5 then raise exception 'a note is required'; end if;
  if jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then raise exception 'choose at least one change'; end if;
  if p_changes ? 'mark_leased' and (select count(*) from jsonb_object_keys(p_changes)) > 1 then
    raise exception 'marking a home as rented cannot be combined with other changes';
  end if;
  for k, v in select * from jsonb_each(p_changes) loop
    case k
      when 'base_rent_cents' then if jsonb_typeof(v) <> 'number' or v::numeric <= 0 or v::numeric > 2000000 or v::numeric <> trunc(v::numeric) then raise exception 'invalid rent'; end if;
      when 'deposit_cents' then if jsonb_typeof(v) <> 'number' or v::numeric < 0 or v::numeric > 6000000 or v::numeric <> trunc(v::numeric) then raise exception 'invalid deposit'; end if;
      when 'application_fee_cents' then if jsonb_typeof(v) <> 'number' or v::numeric < 0 or v::numeric > 20000 or v::numeric <> trunc(v::numeric) then raise exception 'invalid application fee'; end if;
      when 'move_in_date' then if jsonb_typeof(v) <> 'string' or (v #>> '{}')::date not between current_date - 1 and current_date + 366 then raise exception 'invalid move-in date'; end if;
      when 'mark_leased', 'confirm_available' then if v <> 'true'::jsonb then raise exception 'invalid flag %', k; end if;
      else raise exception 'field % cannot be changed by managers', k;
    end case;
  end loop;
  if not hit_rate_limit('edit:' || auth.uid(), 20, 86400) then raise exception 'too many edit requests today' using errcode = 'P0429'; end if;
  insert into listing_edit_requests(listing_id, manager_id, requested_by, changes, note)
  values (l.id, l.property_manager_id, auth.uid(), p_changes, trim(p_note)) returning id into rid;
  return rid;
end $$;
revoke all on function request_listing_edit(text, jsonb, text) from public, anon;
grant execute on function request_listing_edit(text, jsonb, text) to authenticated;

create or replace function decide_listing_edit(p_request uuid, p_approve boolean, p_reason text)
returns text language plpgsql security invoker set search_path = public as $$
declare r listing_edit_requests; c jsonb; price_changed boolean;
begin
  if not is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'a reason is required'; end if;
  if is_verdict_language(p_reason) then raise exception 'use neutral language: describe what was found, not a verdict'; end if;
  select * into r from listing_edit_requests where id = p_request and status = 'open' for update;
  if r.id is null then raise exception 'request not found or already decided'; end if;
  if r.requested_by = auth.uid() then raise exception 'you cannot approve your own edit' using errcode = '42501'; end if;
  c := r.changes;
  if p_approve then
    perform set_config('app.reason', 'manager edit approved: ' || p_reason, true);
    update units set
      base_rent_cents = coalesce((c->>'base_rent_cents')::int, base_rent_cents),
      deposit_cents = case when c ? 'deposit_cents' then (c->>'deposit_cents')::int else deposit_cents end,
      application_fee_cents = case when c ? 'application_fee_cents' then (c->>'application_fee_cents')::int else application_fee_cents end,
      move_in_date = case when c ? 'move_in_date' then (c->>'move_in_date')::date else move_in_date end,
      updated_at = now()
     where listing_id = r.listing_id;
    price_changed := c ?| array['base_rent_cents','deposit_cents','application_fee_cents'];
    update listings set
      status = case when c ? 'mark_leased' then 'leased'::listing_status else status end,
      availability_confirmed_at = case when c ? 'confirm_available' then now() else availability_confirmed_at end,
      last_price_check_at = case when price_changed then now() else last_price_check_at end,
      updated_at = now()
     where id = r.listing_id;
  end if;
  update listing_edit_requests set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now(), reason = p_reason where id = r.id;
  insert into audit_events(entity, entity_id, action, actor_kind, actor_id, to_value, reason)
  values ('listing', r.listing_id, case when p_approve then 'manager_edit_approved' else 'manager_edit_rejected' end, 'human', auth.uid()::text, c::text, p_reason);
  return case when p_approve then 'approved' else 'rejected' end;
end $$;
grant execute on function decide_listing_edit(uuid, boolean, text) to authenticated;
grant update on listing_edit_requests to authenticated;
create policy ler_review on listing_edit_requests for update using (is_reviewer()) with check (is_reviewer());
