-- Phase 11: operational health numbers (aggregates only, no personal data).
create or replace function ops_health() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'stale_visible', (select count(*) from listings
                       where status = 'active'
                         and verification_level in ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED','SOURCE_LISTED_UNVERIFIED')
                         and coalesce(last_verified_at, last_price_check_at, captured_at) < now() - interval '15 days'),
    'queued_overdue', (select count(*) from notifications where status = 'queued' and scheduled_for < now() - interval '30 minutes'),
    'urgent_reports_over_24h', (select count(*) from reports where status = 'open' and reason in ('upfront_payment','off_platform_payment','impersonation') and created_at < now() - interval '24 hours'),
    'by_level', (select jsonb_object_agg(verification_level, n) from (select verification_level, count(*) n from listings where not is_demo group by 1) x),
    'open_reports', (select count(*) from reports where status = 'open'),
    'open_appeals', (select count(*) from appeals where status = 'open')
  );
$$;
revoke all on function ops_health() from public, anon;
grant execute on function ops_health() to authenticated; -- reviewers' dashboard; returns aggregates only
