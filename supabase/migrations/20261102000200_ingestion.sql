-- Phase 4: ingestion support.
alter type location_precision add value if not exists 'zip_approx';

-- Normalized address key for de-duplication across sources.
alter table listings add column if not exists address_key text;
create index if not exists listings_address_key_idx on listings (address_key);

-- Imports from a property manager's own submission (CSV) need the manager's consent on file.
alter table sources add column if not exists consent_ref text;

-- Price history (one row per observed change) — powers "price changed" alerts and anomaly review.
create table if not exists price_history (
  id          bigint generated always as identity primary key,
  unit_id     uuid not null references units(id) on delete cascade,
  listing_id  text not null references listings(id) on delete cascade,
  old_cents   int,
  new_cents   int not null,
  observed_at timestamptz not null default now(),
  source_id   text not null references sources(id)
);
create index if not exists price_history_listing_idx on price_history (listing_id, observed_at desc);
alter table price_history enable row level security;
create policy price_history_read on price_history for select using (exists (select 1 from listings l where l.id = price_history.listing_id));
create policy price_history_write on price_history for all using (is_reviewer()) with check (is_reviewer());
grant select on price_history to anon, authenticated;

create or replace function record_price_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or old.base_rent_cents is distinct from new.base_rent_cents then
    insert into price_history(unit_id, listing_id, old_cents, new_cents, source_id)
    select new.id, new.listing_id, case when tg_op = 'UPDATE' then old.base_rent_cents end, new.base_rent_cents, l.source_id
      from listings l where l.id = new.listing_id;
  end if;
  return new;
end $$;
drop trigger if exists units_price_history on units;
create trigger units_price_history after insert or update of base_rent_cents on units for each row execute function record_price_change();

-- Service-role helpers used by the ingest edge function.
create or replace function search_existing_for_source(p_source_id text) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select d.doc from listing_documents d join listings l on l.id = d.listing_id where l.source_id = p_source_id;
$$;
revoke all on function search_existing_for_source(text) from public, anon, authenticated;

