-- Phase 10: generic fixed-window rate limiter for Edge Functions and RPCs.
create table if not exists rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;  -- no policies: service role / definer only

create or replace function hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
        n int;
begin
  insert into rate_limits(key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into n;
  delete from rate_limits where window_start < now() - interval '1 day' and random() < 0.01; -- lazy cleanup
  return n <= p_limit;
end $$;
revoke all on function hit_rate_limit(text, int, int) from public, anon, authenticated;

-- Throttle anonymous search to blunt scraping of our own data (60 calls/min per IP via PostgREST header).
create or replace function search_guard() returns void language plpgsql security definer set search_path = public as $$
declare ip text := coalesce(nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''), 'unknown');
begin
  if auth.uid() is null and not hit_rate_limit('search:' || ip, 60, 60) then
    raise exception 'Too many searches. Please wait a minute.' using errcode = 'P0429';
  end if;
end $$;

-- Wire the guard into the public search RPC.
create or replace function search_listings(
  p_category text,
  p_include_unverified boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_max_rent_cents int default 200000,
  p_limit int default 500
) returns setof jsonb
language plpgsql volatile security invoker set search_path = public as $$
begin
  perform search_guard();
  return query
  select d.doc
    from listing_documents d
   where d.status = 'active'
     and not d.is_demo
     and d.category = p_category
     and (d.verification_level in ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED')
          or (p_include_unverified and d.verification_level = 'SOURCE_LISTED_UNVERIFIED'))
     and d.base_rent_cents <= least(coalesce(p_max_rent_cents, 200000), 200000)
     and (p_radius_km is null or p_lat is null or
          st_dwithin(d.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000))
   order by d.base_rent_cents
   limit least(greatest(p_limit, 1), 1000);
end $$;
