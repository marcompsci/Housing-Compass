-- LA expansion + competitor-driven fields.
alter table listings
  add column if not exists region text check (region in ('bay_area','la_city','la_county')),
  add column if not exists availability_confirmed_at timestamptz,
  -- How a research lead entered: {observedAt, rawLabel, reviewStatus, researchDoc}. Raw payload kept for moderators.
  add column if not exists intake jsonb;
alter table units
  add column if not exists application_fee_cents int check (application_fee_cents >= 0),
  add column if not exists accepts_vouchers boolean;
create index if not exists listings_region_idx on listings (region, verification_level, status);
create index if not exists listings_intake_status_idx on listings ((intake->>'reviewStatus')) where intake is not null;

-- Rejected research leads are never public, whatever their level.
drop policy if exists listings_public_read on listings;
create policy listings_public_read on listings for select
  using ((status = 'active'
          and verification_level in ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED','SOURCE_LISTED_UNVERIFIED')
          and not is_demo
          and coalesce(intake->>'reviewStatus', '') <> 'rejected')
         or is_reviewer());

-- Column set changes, so the dependent function and view are recreated.
drop function if exists search_listings(text, boolean, double precision, double precision, double precision, int, int);
drop function if exists get_listing(text);
drop function if exists search_existing_for_source(text);
drop view if exists review_queue;
drop view if exists listing_documents;
create view listing_documents with (security_invoker = true) as
select
  l.id as listing_id, u.id as unit_id, l.verification_level, l.status, l.is_demo, l.location, l.region,
  u.base_rent_cents
    + coalesce((select sum((f->>'amountCents')::int) from jsonb_array_elements(coalesce(u.recurring_fees, '[]'::jsonb)) f), 0) as all_in_cents,
  case
    when l.income_restricted then 'INCOME_RESTRICTED'
    when u.unit_type in ('bed_in_shared_room','coliving_room') then 'SHARED_COLIVING'
    when u.unit_type = 'room_in_shared_home' then 'PRIVATE_ROOM'
    when u.unit_type = 'studio' then 'STUDIO'
    when u.unit_type = 'one_bedroom' and u.is_entire_unit then 'ENTIRE_1BR'
    when u.unit_type = 'one_bedroom' then 'PRIVATE_ROOM'
    when u.unit_type = 'two_plus_bedroom' and not u.is_entire_unit then 'PRIVATE_ROOM'
    else null
  end as category,
  jsonb_build_object(
    'id', case when (select count(*) from units u2 where u2.listing_id = l.id) > 1 then l.id || '/' || u.id else l.id end,
    'isDemo', l.is_demo,
    'title', l.title,
    'propertyName', l.property_name,
    'address', jsonb_build_object('line1', l.address_line1, 'unit', l.address_unit, 'city', l.city, 'state', l.state, 'zip', l.zip, 'county', l.county),
    'location', jsonb_build_object('lat', st_y(l.location::geometry), 'lng', st_x(l.location::geometry), 'precision', l.location_precision),
    'unit', jsonb_build_object('unitType', u.unit_type, 'bedrooms', u.bedrooms, 'bathrooms', u.bathrooms, 'sqft', u.sqft, 'isEntireUnit', u.is_entire_unit,
                               'householdBedrooms', u.household_bedrooms, 'unitTypeConfirmed', u.unit_type_confirmed),
    'pricing', jsonb_build_object('basis', u.price_basis, 'basisConfirmed', u.basis_confirmed, 'qualifier', u.price_qualifier, 'baseRentCents', u.base_rent_cents,
                                  'baseRentMaxCents', u.base_rent_max_cents, 'recurringFees', u.recurring_fees, 'utilitiesIncluded', u.utilities_included,
                                  'depositCents', u.deposit_cents, 'moveInCosts', u.move_in_costs, 'concessions', u.concessions,
                                  'applicationFeeCents', u.application_fee_cents),
    'amenities', jsonb_build_object('pets', u.pets, 'furnished', u.furnished, 'accessibility', to_jsonb(u.accessibility), 'parking', u.parking,
                                    'acceptsVouchers', u.accepts_vouchers),
    'lease', jsonb_build_object('minTermMonths', u.min_lease_months, 'moveInDate', u.move_in_date),
    'eligibility', jsonb_build_object('incomeRestricted', l.income_restricted, 'amiPercent', u.ami_percent, 'incomeLimits', u.income_limits,
                                      'minIncomeMultipleOfRent', u.min_income_multiple, 'programType', l.program_type,
                                      'applicationDeadline', l.application_deadline, 'notes', l.eligibility_notes),
    'transit', jsonb_build_object('nearestStops', l.transit),
    'source', jsonb_build_object('sourceId', l.source_id, 'sourceName', coalesce(l.source_display_name, s.name), 'sourceKind', s.kind,
                                 'listingUrl', l.listing_url, 'searchPageUrls', to_jsonb(l.search_page_urls), 'sourceListingId', l.source_listing_id,
                                 'capturedAt', l.captured_at, 'lastPriceCheckAt', l.last_price_check_at),
    'verification', jsonb_build_object('level', l.verification_level, 'lastVerifiedAt', l.last_verified_at,
                                       'availabilityConfirmedAt', l.availability_confirmed_at, 'verifiedBy', l.verified_by::text,
                                       'checklist', public_checklist(l.id), 'signals', '[]'::jsonb),
    'status', l.status,
    'contact', case when l.contact_channel is null then null else jsonb_build_object('channel', l.contact_channel, 'value', l.contact_value,
                                                                                    'independentlyConfirmed', l.contact_independently_confirmed) end,
    'description', l.description,
    'imageHashes', to_jsonb(l.image_hashes),
    'managerId', l.property_manager_id::text,
    'intake', l.intake
  ) as doc
from listings l
join units u on u.listing_id = l.id
join sources s on s.id = l.source_id;

create or replace function get_listing(p_id text) returns jsonb
language sql stable security invoker set search_path = public as $$
  select d.doc from listing_documents d where d.doc->>'id' = p_id limit 1;
$$;
grant execute on function get_listing(text) to anon, authenticated;

create or replace function search_existing_for_source(p_source_id text) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select d.doc from listing_documents d join listings l on l.id = d.listing_id where l.source_id = p_source_id;
$$;
revoke all on function search_existing_for_source(text) from public, anon, authenticated;

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
grant select on review_queue to authenticated;

create or replace function search_listings(
  p_category text,
  p_include_unverified boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_max_rent_cents int default 200000,
  p_limit int default 500,
  p_region text default null
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
     and (p_region is null or d.region = p_region or (p_region = 'la_county' and d.region = 'la_city'))
     and (d.verification_level in ('OFFICIAL_PORTAL','PROPERTY_MANAGER_VERIFIED')
          or (p_include_unverified and d.verification_level = 'SOURCE_LISTED_UNVERIFIED'))
     and coalesce(d.doc->'intake'->>'reviewStatus', '') <> 'rejected'
     -- Budget cap applies to the all-in monthly cost when fees are known.
     and d.all_in_cents <= least(coalesce(p_max_rent_cents, 200000), 200000)
     and (p_radius_km is null or p_lat is null or
          st_dwithin(d.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000))
   order by d.all_in_cents
   limit least(greatest(p_limit, 1), 1000);
end $$;
grant execute on function search_listings(text, boolean, double precision, double precision, double precision, int, int, text) to anon, authenticated;
grant select on listing_documents to anon, authenticated;

-- Moderator decisions for research leads (in addition to review_decide).
create or replace function lead_decide(p_listing_id text, p_decision text, p_reason text)
returns text language plpgsql security invoker set search_path = public as $$
begin
  if not is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'a reason is required'; end if;
  perform set_config('app.reason', 'lead ' || p_decision || ': ' || p_reason, true);
  if p_decision = 'source_found' then
    -- A moderator re-opened the source page and saw the ad still posted at this price.
    update listings set intake = jsonb_set(coalesce(intake, '{}'::jsonb), '{reviewStatus}', '"source_found"'),
                        last_price_check_at = now()
     where id = p_listing_id and intake is not null and verification_level = 'SOURCE_LISTED_UNVERIFIED';
  elsif p_decision = 'reject' then
    update listings set intake = jsonb_set(coalesce(intake, '{}'::jsonb), '{reviewStatus}', '"rejected"'), status = 'removed'
     where id = p_listing_id and intake is not null;
  else
    raise exception 'unknown decision %', p_decision;
  end if;
  if not found then raise exception 'not a research lead in a state for %', p_decision; end if;
  insert into listing_checks(listing_id, check_kind, outcome, details, actor_kind, actor_id)
  values (p_listing_id, 'source_recheck', case when p_decision = 'source_found' then 'pass' else 'fail' end, jsonb_build_object('decision', p_decision), 'human', auth.uid()::text);
  return p_decision;
end $$;
grant execute on function lead_decide(text, text, text) to authenticated;
