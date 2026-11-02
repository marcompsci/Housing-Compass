-- Phase 5: reviewer workflow. Every decision is a function call so it is validated and audited
-- in one place; the trust trigger still enforces evidence for verification.

create or replace view review_queue with (security_invoker = true) as
select l.id, l.title, l.city, l.verification_level, l.status, l.source_id, l.updated_at,
       (select count(*) from reports r where r.listing_id = l.id and r.status = 'open') as open_reports,
       (select array_agg(distinct r.reason::text) from reports r where r.listing_id = l.id and r.status = 'open') as report_reasons,
       (select count(*) from appeals a where a.listing_id = l.id and a.status = 'open') as open_appeals,
       (select count(distinct e.check_type) from verification_evidence e where e.listing_id = l.id and e.passed) as checks_passed
  from listings l
 where l.verification_level = 'FLAGGED'
    or exists (select 1 from reports r where r.listing_id = l.id and r.status = 'open')
    or exists (select 1 from appeals a where a.listing_id = l.id and a.status = 'open');
grant select on review_queue to authenticated; -- RLS on listings limits rows to reviewers for hidden levels

create or replace function review_decide(p_listing_id text, p_decision text, p_reason text)
returns verification_level
language plpgsql security invoker set search_path = public as $$
declare lvl verification_level;
begin
  if not is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'a reason is required'; end if;
  if p_reason ~* '\m(fraud|scam(mer)?)\M' and p_decision <> 'remove' then
    raise exception 'use neutral language: describe what was found, not a verdict';
  end if;
  perform set_config('app.reason', p_decision || ': ' || p_reason, true);

  case p_decision
    when 'verify' then
      update listings set verification_level = 'PROPERTY_MANAGER_VERIFIED', last_verified_at = now(), verified_by = auth.uid(), status = 'active' where id = p_listing_id;
    when 'clear_flag' then
      update listings set verification_level = 'SOURCE_LISTED_UNVERIFIED', status = 'active' where id = p_listing_id and verification_level = 'FLAGGED';
    when 'expire' then
      update listings set verification_level = 'EXPIRED', status = 'expired' where id = p_listing_id;
    when 'remove' then
      update listings set status = 'removed', verification_level = 'FLAGGED' where id = p_listing_id;
    else raise exception 'unknown decision %', p_decision;
  end case;
  if not found then raise exception 'listing not found or not in a state for %', p_decision; end if;

  update reports set status = case when p_decision in ('remove','expire') then 'actioned'::report_status else 'dismissed'::report_status end,
                     resolution = p_reason, resolved_by = auth.uid(), resolved_at = now()
   where listing_id = p_listing_id and status = 'open';

  insert into listing_checks(listing_id, check_kind, outcome, details, actor_kind, actor_id)
  values (p_listing_id, 'manager_verification', case when p_decision = 'verify' then 'pass' else 'fail' end, jsonb_build_object('decision', p_decision), 'human', auth.uid()::text);

  select verification_level into lvl from listings where id = p_listing_id;
  return lvl;
end $$;

create or replace function appeal_decide(p_appeal_id uuid, p_uphold boolean, p_decision text)
returns void language plpgsql security invoker set search_path = public as $$
declare lid text;
begin
  if not is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  update appeals set status = case when p_uphold then 'actioned'::report_status else 'dismissed'::report_status end,
                     decision = p_decision, decided_by = auth.uid(), decided_at = now()
   where id = p_appeal_id and status = 'open' returning listing_id into lid;
  if lid is null then raise exception 'appeal not found or already decided'; end if;
  if p_uphold then
    perform set_config('app.reason', 'appeal upheld: ' || p_decision, true);
    update listings set verification_level = 'SOURCE_LISTED_UNVERIFIED', status = 'active' where id = lid and verification_level = 'FLAGGED';
  end if;
  insert into audit_events(entity, entity_id, action, actor_kind, actor_id, to_value, reason)
  values ('appeal', p_appeal_id::text, 'appeal_decided', 'human', auth.uid()::text, case when p_uphold then 'upheld' else 'denied' end, p_decision);
end $$;

grant execute on function review_decide(text, text, text), appeal_decide(uuid, boolean, text) to authenticated;
-- audit_events inserts from these SECURITY INVOKER functions need the reviewer to be able to insert:
create policy audit_reviewer_insert on audit_events for insert with check (is_reviewer());
grant insert on audit_events to authenticated;
