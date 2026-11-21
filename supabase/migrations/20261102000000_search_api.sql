-- Phase 3: read API. Produces documents in exactly the shape of core's ListingSchema
-- (validated by packages/core/test/db.integration.test.ts) plus a search RPC.

alter table listings add column if not exists source_display_name text;
update listings l set source_display_name = s.name from sources s where s.id = l.source_id and l.source_display_name is null;

-- Public checklist: pass/fail + evidence ids only. Evidence contents stay reviewer-only.
create or replace function public_checklist(p_listing_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  with per_check as (
    select c::text as chk,
           bool_or(e.passed) as passed,
           coalesce(jsonb_agg(e.id::text) filter (where e.passed), '[]'::jsonb) as ids,
           max(e.collected_at) as at
      from unnest(enum_range(null::verification_check)) c
      join verification_evidence e on e.listing_id = p_listing_id and e.check_type = c
     group by c
  )
  select coalesce(jsonb_agg(jsonb_build_object('check', chk, 'passed', coalesce(passed, false), 'evidenceIds', ids, 'checkedAt', at, 'checkedBy', null)), '[]'::jsonb)
    from per_check;
$$;

create or replace view listing_documents with (security_invoker = true) as
select
  l.id as listing_id,
  u.id as unit_id,
  l.verification_level,
  l.status,
  l.is_demo,
  l.location,
  u.base_rent_cents,
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
                                  'depositCents', u.deposit_cents, 'moveInCosts', u.move_in_costs, 'concessions', u.concessions),
    'amenities', jsonb_build_object('pets', u.pets, 'furnished', u.furnished, 'accessibility', to_jsonb(u.accessibility), 'parking', u.parking),
    'lease', jsonb_build_object('minTermMonths', u.min_lease_months, 'moveInDate', u.move_in_date),
    'eligibility', jsonb_build_object('incomeRestricted', l.income_restricted, 'amiPercent', u.ami_percent, 'incomeLimits', u.income_limits,
                                      'minIncomeMultipleOfRent', u.min_income_multiple, 'programType', l.program_type,
                                      'applicationDeadline', l.application_deadline, 'notes', l.eligibility_notes),
    'transit', jsonb_build_object('nearestStops', l.transit),
    'source', jsonb_build_object('sourceId', l.source_id, 'sourceName', coalesce(l.source_display_name, s.name), 'sourceKind', s.kind,
                                 'listingUrl', l.listing_url, 'searchPageUrls', to_jsonb(l.search_page_urls), 'sourceListingId', l.source_listing_id,
                                 'capturedAt', l.captured_at, 'lastPriceCheckAt', l.last_price_check_at),
    'verification', jsonb_build_object('level', l.verification_level, 'lastVerifiedAt', l.last_verified_at, 'verifiedBy', l.verified_by::text,
                                       'checklist', public_checklist(l.id), 'signals', '[]'::jsonb),
    'status', l.status,
    'contact', case when l.contact_channel is null then null else jsonb_build_object('channel', l.contact_channel, 'value', l.contact_value,
                                                                                    'independentlyConfirmed', l.contact_independently_confirmed) end,
    'description', l.description,
    'imageHashes', to_jsonb(l.image_hashes)
  ) as doc
from listings l
join units u on u.listing_id = l.id
join sources s on s.id = l.source_id;

-- Server-side narrowing; the client re-applies core.search() for ordering and "not confirmed" handling.
create or replace function search_listings(
  p_category text,
  p_include_unverified boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_max_rent_cents int default 200000,
  p_limit int default 500
) returns setof jsonb
language sql stable security invoker set search_path = public as $$
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
$$;

create or replace function get_listing(p_id text) returns jsonb
language sql stable security invoker set search_path = public as $$
  select d.doc from listing_documents d where d.doc->>'id' = p_id limit 1;
$$;

-- Counts hidden leads without exposing them.
create or replace function expired_lead_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from listings where verification_level = 'EXPIRED' and source_id like 'research-%';
$$;

grant select on listing_documents to anon, authenticated;
grant execute on function search_listings(text, boolean, double precision, double precision, double precision, int, int), get_listing(text), expired_lead_count(), public_checklist(text) to anon, authenticated;
