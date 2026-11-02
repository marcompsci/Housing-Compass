-- Phase 7: richer application tracking (history kept per user, private by RLS).
alter table applications add column if not exists title text check (char_length(title) <= 200),
                         add column if not exists history jsonb not null default '[]'::jsonb;
create index if not exists applications_user_idx on applications (user_id, updated_at desc);
create or replace function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists applications_touch on applications;
create trigger applications_touch before update on applications for each row execute function touch_updated_at();
