create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  base_name text;
begin
  base_name := coalesce(nullif(split_part(new.email, '@', 1), ''), 'user');
  insert into public.profiles(id, username)
  values (
    new.id,
    left(base_name, 23) || '_' || substr(new.id::text, 1, 8)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
