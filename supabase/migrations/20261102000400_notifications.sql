-- Phase 6: alert preferences, push tokens, and a safe queue drain.
alter table user_profiles
  add column if not exists quiet_start smallint check (quiet_start between 0 and 23) default 21,
  add column if not exists quiet_end smallint check (quiet_end between 0 and 23) default 8,
  add column if not exists utc_offset_minutes smallint not null default -480,
  add column if not exists max_push_per_day smallint not null default 5 check (max_push_per_day between 0 and 20);

alter table notifications add column if not exists title text, add column if not exists body text, add column if not exists listing_id text references listings(id) on delete set null;

create table if not exists push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null check (platform in ('ios','android','web')),
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table push_tokens enable row level security;
create policy push_tokens_own on push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on push_tokens to authenticated;

-- Workers claim a batch atomically; a crashed worker's rows return to the queue after 10 minutes.
create or replace function claim_notifications(p_batch int default 100)
returns setof notifications language sql security definer set search_path = public as $$
  update notifications n set status = 'sending', attempts = attempts + 1
   where n.id in (
     select id from notifications
      where (status = 'queued' and scheduled_for <= now())
         or (status = 'sending' and scheduled_for <= now() - interval '10 minutes' and attempts < 5)
      order by scheduled_for
      limit greatest(1, least(p_batch, 500))
      for update skip locked)
  returning n.*;
$$;
revoke all on function claim_notifications(int) from public, anon, authenticated;

-- Users may mark their in-app notifications read, nothing else.
drop policy if exists notifications_own_mark on notifications;
create policy notifications_own_mark on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid() and status in ('queued','sent'));
