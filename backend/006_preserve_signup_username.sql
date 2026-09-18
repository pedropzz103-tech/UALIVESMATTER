create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested text;
  candidate text;
begin
  requested := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'username',''), '[^[:alnum:]_.-]+', '', 'g'), '');
  candidate := coalesce(requested, nullif(split_part(new.email, '@', 1), ''), 'user');
  candidate := left(candidate, 23);

  if exists(select 1 from public.profiles where username=candidate) then
    candidate := candidate || '_' || substr(new.id::text, 1, 8);
  end if;

  insert into public.profiles(id, username)
  values (new.id, candidate)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
