-- Phase 3: account lifecycle.

-- Create a profile row for every new auth user (role always 'user').
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into user_profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Self-service data deletion (CCPA/CPRA "right to delete"). Reports and appeals are kept
-- but de-identified, because they protect other renters; audit history is append-only.
create or replace function delete_my_data() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from favorites      where user_id = uid;
  delete from saved_searches where user_id = uid;
  delete from applications   where user_id = uid;
  delete from notifications  where user_id = uid;
  update reports set details = null where reporter_id = uid;
  update user_profiles set display_name = null, home_area = null where id = uid;
  insert into audit_events(entity, entity_id, action, actor_kind, actor_id, reason)
  values ('user', uid::text, 'data_deleted', 'human', uid::text, 'self-service deletion');
end $$;
revoke all on function delete_my_data() from public, anon;
grant execute on function delete_my_data() to authenticated;
