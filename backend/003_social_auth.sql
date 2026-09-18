-- Auth profiles, social feed, stories, likes and editable checklists
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id, username)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'user_' || substr(new.id::text, 1, 8))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 2000),
  media_url text not null,
  media_type text not null check (media_type in ('image','video')),
  created_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image','video')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id, user_id)
);

create table if not exists public.user_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) <= 160),
  checked boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.stories enable row level security;
alter table public.post_likes enable row level security;
alter table public.user_checklist_items enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid()=id) with check (auth.uid()=id);

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to authenticated using (true);
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts for delete to authenticated using (auth.uid()=user_id);

drop policy if exists stories_read on public.stories;
create policy stories_read on public.stories for select to authenticated using (expires_at > now());
drop policy if exists stories_insert_own on public.stories;
create policy stories_insert_own on public.stories for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists stories_delete_own on public.stories;
create policy stories_delete_own on public.stories for delete to authenticated using (auth.uid()=user_id);

drop policy if exists likes_read on public.post_likes;
create policy likes_read on public.post_likes for select to authenticated using (true);
drop policy if exists likes_insert_own on public.post_likes;
create policy likes_insert_own on public.post_likes for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists likes_delete_own on public.post_likes;
create policy likes_delete_own on public.post_likes for delete to authenticated using (auth.uid()=user_id);

drop policy if exists checklist_own_all on public.user_checklist_items;
create policy checklist_own_all on public.user_checklist_items
for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists alerts_insert on public.community_alerts;
create policy alerts_insert on public.community_alerts for insert to authenticated with check (true);
drop policy if exists votes_write on public.alert_votes;
create policy votes_write on public.alert_votes for insert to authenticated with check (true);
drop policy if exists votes_update on public.alert_votes;
create policy votes_update on public.alert_votes for update to authenticated using (true) with check (true);
drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select to authenticated using (created_at > now() - interval '24 hours');
drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages for insert to authenticated with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social','social',true,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=true, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists social_media_insert_own on storage.objects;
create policy social_media_insert_own on storage.objects
for insert to authenticated with check (bucket_id='social' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists social_media_update_own on storage.objects;
create policy social_media_update_own on storage.objects
for update to authenticated using (bucket_id='social' and owner_id=auth.uid()::text)
with check (bucket_id='social' and owner_id=auth.uid()::text);
drop policy if exists social_media_delete_own on storage.objects;
create policy social_media_delete_own on storage.objects
for delete to authenticated using (bucket_id='social' and owner_id=auth.uid()::text);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='posts')
  then alter publication supabase_realtime add table public.posts; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='stories')
  then alter publication supabase_realtime add table public.stories; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='post_likes')
  then alter publication supabase_realtime add table public.post_likes; end if;
end $$;
