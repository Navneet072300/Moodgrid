insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('moodgrid-stickers','moodgrid-stickers',false,3145728,array['image/png','image/jpeg','image/webp','image/gif','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Upload own MoodGrid stickers" on storage.objects for insert to authenticated
with check (bucket_id = 'moodgrid-stickers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Read own MoodGrid stickers" on storage.objects for select to authenticated
using (bucket_id = 'moodgrid-stickers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Remove unused MoodGrid stickers" on storage.objects for delete to authenticated
using (
  bucket_id = 'moodgrid-stickers' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.stickers s join public.entries e on e.sticker_id = s.id
    where s.storage_path = storage.objects.name and s.user_id = (select auth.uid())
  )
);
