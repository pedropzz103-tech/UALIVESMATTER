create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists stories_user_id_idx on public.stories(user_id);
create index if not exists post_likes_user_id_idx on public.post_likes(user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using ((select auth.uid())=id) with check ((select auth.uid())=id);

drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert to authenticated
with check ((select auth.uid())=user_id);
drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts for update to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts for delete to authenticated
using ((select auth.uid())=user_id);

drop policy if exists stories_insert_own on public.stories;
create policy stories_insert_own on public.stories for insert to authenticated
with check ((select auth.uid())=user_id);
drop policy if exists stories_delete_own on public.stories;
create policy stories_delete_own on public.stories for delete to authenticated
using ((select auth.uid())=user_id);

drop policy if exists likes_insert_own on public.post_likes;
create policy likes_insert_own on public.post_likes for insert to authenticated
with check ((select auth.uid())=user_id);
drop policy if exists likes_delete_own on public.post_likes;
create policy likes_delete_own on public.post_likes for delete to authenticated
using ((select auth.uid())=user_id);

drop policy if exists checklist_own_all on public.user_checklist_items;
create policy checklist_own_all on public.user_checklist_items
for all to authenticated
using ((select auth.uid())=user_id)
with check ((select auth.uid())=user_id);

drop policy if exists social_media_insert_own on storage.objects;
create policy social_media_insert_own on storage.objects
for insert to authenticated
with check (bucket_id='social' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists social_media_update_own on storage.objects;
create policy social_media_update_own on storage.objects
for update to authenticated
using (bucket_id='social' and owner_id=(select auth.uid())::text)
with check (bucket_id='social' and owner_id=(select auth.uid())::text);

drop policy if exists social_media_delete_own on storage.objects;
create policy social_media_delete_own on storage.objects
for delete to authenticated
using (bucket_id='social' and owner_id=(select auth.uid())::text);
