-- Run after 202609180001_encrypted_vault.sql. Does not delete any existing data.
-- The browser removes references from its encrypted vault before using the
-- Storage DELETE API. SQL deletion of storage.objects alone would orphan bytes.
drop policy if exists "Delete own encrypted MoodGrid stickers" on storage.objects;
create policy "Delete own encrypted MoodGrid stickers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'moodgrid-vault'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.bin$'
  and exists (
    select 1 from public.encrypted_vaults
    where user_id = (select auth.uid()) and migration_stage = 'complete'
  )
);
