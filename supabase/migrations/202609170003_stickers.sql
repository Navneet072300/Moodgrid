create table public.stickers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','image/gif','video/webm')),
  size_bytes integer not null check (size_bytes between 1 and 3145728),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (storage_path ~ ('^' || user_id::text || '/[0-9a-f-]+\.(png|jpg|webp|gif|webm)$'))
);
create index stickers_user_created_idx on public.stickers(user_id, created_at desc);
alter table public.stickers enable row level security;
revoke all on public.stickers from anon, authenticated;
grant select, insert, delete on public.stickers to authenticated;
grant update(name) on public.stickers to authenticated;
create policy "Owners manage stickers" on public.stickers for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.entries alter column emoji drop not null;
alter table public.entries add column sticker_id uuid;
alter table public.entries add column mood_score smallint check (mood_score between 1 and 5);
alter table public.entries add constraint entries_sticker_owner_fkey
  foreign key (sticker_id, user_id) references public.stickers(id, user_id) on delete restrict;
alter table public.entries add constraint entries_one_expression_check
  check ((emoji is not null) <> (sticker_id is not null));

-- Preserve the existing interpretation of the original forty mood emojis.
update public.entries set mood_score = case
  when emoji in ('😊','😄','🥰','🤩','😎','🥳','😁') then 5
  when emoji in ('😌','🥹','🤗','🙂','😇','🤠','🤓','🧘') then 4
  when emoji in ('😐','😶','🤔','😴','🥱','🙃','😅') then 3
  when emoji in ('😬','🫠','😵‍💫','😔','😢','🥺','😞','😓','😟','😰','😤','🤒') then 2
  when emoji in ('😠','😩','😭','😡','🤯','😨') then 1
  else null end;

-- The old signature delegates to the new atomic operation for compatibility.
create function public.save_journal_entry(p_date date, p_emoji text, p_sticker_id uuid, p_mood_score smallint, p_note text, p_tags text[])
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_entry uuid; v_tag uuid; v_name text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_date > current_date + 1 then raise exception 'Future entries are not allowed'; end if;
  if coalesce(cardinality(p_tags), 0) > 8 then raise exception 'Maximum eight tags'; end if;
  if p_sticker_id is not null and not exists (select 1 from public.stickers where id = p_sticker_id and user_id = v_user)
    then raise exception 'Sticker is not in your library'; end if;
  insert into public.entries(user_id, date, emoji, sticker_id, mood_score, note)
  values (v_user, p_date, p_emoji, p_sticker_id, p_mood_score, nullif(btrim(p_note), ''))
  on conflict (user_id, date) do update set emoji = excluded.emoji, sticker_id = excluded.sticker_id,
    mood_score = excluded.mood_score, note = excluded.note
  returning id into v_entry;
  delete from public.entry_tags where entry_id = v_entry;
  foreach v_name in array coalesce(p_tags, array[]::text[]) loop
    v_name := lower(btrim(v_name));
    if v_name = '' or char_length(v_name) > 24 then raise exception 'Invalid tag'; end if;
    insert into public.tags(user_id, name) values (v_user, v_name)
    on conflict (user_id, name) do update set name = excluded.name returning id into v_tag;
    insert into public.entry_tags(entry_id, tag_id) values (v_entry, v_tag) on conflict do nothing;
  end loop;
  return v_entry;
end;
$$;
revoke all on function public.save_journal_entry(date,text,uuid,smallint,text,text[]) from public, anon;
grant execute on function public.save_journal_entry(date,text,uuid,smallint,text,text[]) to authenticated;

create or replace function public.save_mood_entry(p_date date, p_emoji text, p_note text, p_tags text[])
returns uuid language sql security invoker set search_path = '' as $$
  select public.save_journal_entry(p_date, p_emoji, null::uuid, null::smallint, p_note, p_tags);
$$;
