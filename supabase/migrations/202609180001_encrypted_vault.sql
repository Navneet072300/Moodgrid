-- Client-side encryption. This migration freezes legacy plaintext writes;
-- each user must unlock/create their vault to migrate existing content.
create function public.valid_vault_envelope(value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'object' and value->>'v' = '1'
    and (select count(*) from jsonb_object_keys(value)) = 3
    and value->>'iv' ~ '^[A-Za-z0-9+/]{16}$'
    and length(value->>'data') between 24 and 12582912
    and value->>'data' ~ '^[A-Za-z0-9+/]*={0,2}$', false);
$$;
create table public.encrypted_vaults (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  salt text not null check (salt ~ '^[A-Za-z0-9+/]{22}==$'),
  iterations integer not null default 600000 check (iterations = 600000),
  wrapped_key jsonb not null check (public.valid_vault_envelope(wrapped_key) and length(wrapped_key->>'data') = 64),
  recovery_wrapped_key jsonb not null check (public.valid_vault_envelope(recovery_wrapped_key) and length(recovery_wrapped_key->>'data') = 64),
  ciphertext jsonb not null check (public.valid_vault_envelope(ciphertext)),
  revision integer not null default 1 check (revision > 0),
  migration_stage text not null default 'pending' check (migration_stage in ('pending','files','complete'))
);
alter table public.encrypted_vaults enable row level security;
revoke all on public.encrypted_vaults from anon, authenticated;
grant select on public.encrypted_vaults to authenticated;
create policy "Read own encrypted vault" on public.encrypted_vaults for select to authenticated using (user_id = (select auth.uid()));

-- Fixed user scope, used by migration RPCs only. No owner parameter is accepted.
create function public.moodgrid_legacy_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select jsonb_build_object(
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.entries e where e.user_id = uid), '[]'::jsonb),
    'tags', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.tags t where t.user_id = uid), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(to_jsonb(et) order by et.entry_id, et.tag_id) from public.entry_tags et join public.entries e on e.id = et.entry_id where e.user_id = uid), '[]'::jsonb),
    'stickers', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.stickers s where s.user_id = uid), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(o.name order by o.name) from storage.objects o where o.bucket_id = 'moodgrid-stickers' and (storage.foldername(o.name))[1] = uid::text), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.moodgrid_legacy_snapshot() from public, anon, authenticated;
create function public.read_legacy_journal() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare snapshot jsonb;
begin
  snapshot := public.moodgrid_legacy_snapshot();
  return jsonb_build_object('snapshot', snapshot, 'fingerprint', encode(sha256(convert_to(snapshot::text, 'UTF8')), 'hex'));
end;
$$;
revoke all on function public.read_legacy_journal() from public, anon;
grant execute on function public.read_legacy_journal() to authenticated;

create function public.create_encrypted_vault(p_vault_user_id uuid, p_config jsonb, p_ciphertext jsonb, p_fingerprint text) returns public.encrypted_vaults
language plpgsql security definer set search_path = '' as $$
declare result public.encrypted_vaults; uid uuid := auth.uid();
begin
  if uid is null or uid is distinct from p_vault_user_id then raise exception 'Authentication required'; end if;
  if p_fingerprint is distinct from encode(sha256(convert_to(public.moodgrid_legacy_snapshot()::text, 'UTF8')), 'hex') then raise exception 'Legacy journal changed; reload before migrating'; end if;
  insert into public.encrypted_vaults(user_id,salt,iterations,wrapped_key,recovery_wrapped_key,ciphertext)
  values (uid,p_config->>'salt',(p_config->>'iterations')::integer,p_config->'wrapped_key',p_config->'recovery_wrapped_key',p_ciphertext)
  returning * into result;
  return result;
end;
$$;
create function public.save_encrypted_vault(p_vault_user_id uuid, p_expected_revision integer, p_ciphertext jsonb) returns public.encrypted_vaults
language plpgsql security definer set search_path = '' as $$
declare result public.encrypted_vaults;
begin
  update public.encrypted_vaults set ciphertext = p_ciphertext, revision = revision + 1
  where user_id = auth.uid() and user_id = p_vault_user_id and revision = p_expected_revision and migration_stage = 'complete' returning * into result;
  if result.user_id is null then raise exception 'Vault changed or locked; reload and unlock again'; end if;
  return result;
end;
$$;
create function public.rewrap_vault_key(p_vault_user_id uuid, p_expected_revision integer, p_salt text, p_wrapped_key jsonb) returns public.encrypted_vaults
language plpgsql security definer set search_path = '' as $$
declare result public.encrypted_vaults;
begin
  update public.encrypted_vaults set salt = p_salt, wrapped_key = p_wrapped_key, revision = revision + 1
  where user_id = auth.uid() and user_id = p_vault_user_id and revision = p_expected_revision returning * into result;
  if result.user_id is null then raise exception 'Vault changed; reload and unlock again'; end if;
  return result;
end;
$$;
-- Call only AFTER the browser reads back and decrypts the vault and every file.
create function public.finalize_vault_migration(p_vault_user_id uuid, p_expected_revision integer, p_fingerprint text) returns public.encrypted_vaults
language plpgsql security definer set search_path = '' as $$
declare result public.encrypted_vaults; uid uuid := auth.uid();
begin
  select * into result from public.encrypted_vaults where user_id = uid and user_id = p_vault_user_id for update;
  if result.user_id is null or result.revision <> p_expected_revision then raise exception 'Vault changed; reload before migrating'; end if;
  if result.migration_stage <> 'pending' then return result; end if;
  if p_fingerprint is distinct from encode(sha256(convert_to(public.moodgrid_legacy_snapshot()::text, 'UTF8')), 'hex') then raise exception 'Legacy journal changed; original data preserved'; end if;
  delete from public.entries where user_id = uid;
  delete from public.tags where user_id = uid;
  delete from public.stickers where user_id = uid;
  delete from public.summary_rate_limits where user_id = uid;
  update public.encrypted_vaults set migration_stage = 'files', revision = revision + 1 where user_id = uid returning * into result;
  return result;
end;
$$;
create function public.complete_vault_migration(p_vault_user_id uuid, p_expected_revision integer) returns public.encrypted_vaults
language plpgsql security definer set search_path = '' as $$
declare result public.encrypted_vaults; uid uuid := auth.uid();
begin
  if exists (select 1 from public.entries where user_id = uid)
    or exists (select 1 from public.tags where user_id = uid)
    or exists (select 1 from public.stickers where user_id = uid)
    or exists (select 1 from storage.objects where bucket_id = 'moodgrid-stickers' and (storage.foldername(name))[1] = uid::text)
    then raise exception 'Plaintext cleanup is not complete'; end if;
  update public.encrypted_vaults set migration_stage = 'complete', revision = revision + 1
  where user_id = uid and user_id = p_vault_user_id and revision = p_expected_revision and migration_stage = 'files' returning * into result;
  if result.user_id is null then raise exception 'Vault changed; reload before finishing'; end if;
  return result;
end;
$$;
revoke all on function public.create_encrypted_vault(uuid,jsonb,jsonb,text), public.save_encrypted_vault(uuid,integer,jsonb), public.rewrap_vault_key(uuid,integer,text,jsonb), public.finalize_vault_migration(uuid,integer,text), public.complete_vault_migration(uuid,integer) from public, anon;
grant execute on function public.create_encrypted_vault(uuid,jsonb,jsonb,text), public.save_encrypted_vault(uuid,integer,jsonb), public.rewrap_vault_key(uuid,integer,text,jsonb), public.finalize_vault_migration(uuid,integer,text), public.complete_vault_migration(uuid,integer) to authenticated;

-- Old clients cannot write plaintext after this migration is installed.
revoke insert, update, delete on public.entries, public.tags, public.entry_tags, public.stickers from authenticated;
revoke update(name) on public.stickers from authenticated;
revoke execute on function public.save_mood_entry(date,text,text,text[]), public.save_journal_entry(date,text,uuid,smallint,text,text[]), public.claim_weekly_summary() from authenticated;
drop policy "Upload own MoodGrid stickers" on storage.objects;
drop policy "Remove unused MoodGrid stickers" on storage.objects;
create policy "Remove migrated plaintext stickers" on storage.objects for delete to authenticated using (
  bucket_id = 'moodgrid-stickers' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.encrypted_vaults where user_id = (select auth.uid()) and migration_stage in ('files','complete'))
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('moodgrid-vault','moodgrid-vault',false,5242880,array['application/octet-stream'])
on conflict(id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "Upload encrypted files" on storage.objects for insert to authenticated with check (
  bucket_id = 'moodgrid-vault' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]+\.bin$')
);
create policy "Read encrypted files" on storage.objects for select to authenticated using (
  bucket_id = 'moodgrid-vault' and (storage.foldername(name))[1] = (select auth.uid())::text
);
-- Immutable ciphertext objects; no client overwrite/delete policy.
