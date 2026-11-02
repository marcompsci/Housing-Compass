-- v0.16: keyword search on the server, so typed searches narrow results before the 500-row limit.
-- Every word must appear in the title, property name, street, city, ZIP or county (case- and accent-insensitive).

create or replace function search_text_norm(p text) returns text
language sql immutable parallel safe set search_path = public as $$
  select trim(regexp_replace(lower(translate(coalesce(p, ''),
    'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑñÇç',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc')), '[^a-z0-9一-鿿]+', ' ', 'g'))
$$;

create or replace function listing_matches_query(d jsonb, p_query text) returns boolean
language plpgsql immutable parallel safe set search_path = public as $$
declare
  q text := search_text_norm(left(p_query, 80));
  hay text;
  w text;
begin
  if q = '' then return true; end if;
  hay := search_text_norm(concat_ws(' ', d->>'title', d->>'propertyName', d->'address'->>'line1', d->'address'->>'city', d->'address'->>'zip', d->'address'->>'county'));
  foreach w in array regexp_split_to_array(q, ' ') loop
    if position(w in hay) = 0 then return false; end if;
  end loop;
  return true;
end $$;

drop function if exists search_listings(text, boolean, double precision, double precision, double precision, int, int, text, jsonb);
create or replace function search_listings(
  p_category text,
  p_include_unverified boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_max_rent_cents int default 200000,
  p_limit int default 500,
  p_region text default null,
  p_area jsonb default null,
  p_query text default null
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
     and (p_query is null or listing_matches_query(d.doc, p_query))
   order by d.all_in_cents
   limit least(greatest(p_limit, 1), 1000);
end $$;
grant execute on function search_listings(text, boolean, double precision, double precision, double precision, int, int, text, jsonb, text) to anon, authenticated;
