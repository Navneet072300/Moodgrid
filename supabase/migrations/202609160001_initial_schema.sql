-- Run once with Supabase migrations or in the Supabase SQL editor.
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  emoji text not null check (emoji in (
    '😊','😄','🥰','🤩','😎','🥳','😌','🥹','😁','🤗',
    '🙂','😇','🤠','🤓','🧘','😐','😶','🤔','😴','🥱',
    '🙃','😅','😬','🫠','😵‍💫','😔','😢','🥺','😞','😓',
    '😟','😰','😤','😠','😩','😭','😡','🤯','😨','🤒'
  )),
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  constraint entries_user_date_key unique (user_id, date)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24 and name = lower(btrim(name))),
  constraint tags_user_name_key unique (user_id, name)
);

create table public.entry_tags (
  entry_id uuid not null references public.entries(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (entry_id, tag_id)
);
create index entry_tags_tag_idx on public.entry_tags(tag_id);

alter table public.entries enable row level security;
alter table public.tags enable row level security;
alter table public.entry_tags enable row level security;

create policy "Owners manage entries" on public.entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Owners manage tags" on public.tags
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Owners manage their entry tag links" on public.entry_tags
  for all to authenticated
  using (
    exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  );

revoke all on public.entries, public.tags, public.entry_tags from anon;
grant select, insert, update, delete on public.entries, public.tags, public.entry_tags to authenticated;

-- A single transaction replaces the entry and all its tag links. The invoker's
-- JWT and RLS apply throughout; callers never supply a user_id.
create function public.save_mood_entry(p_date date, p_emoji text, p_note text, p_tags text[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_entry uuid;
  v_tag uuid;
  v_name text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_date > current_date + 1 then raise exception 'Future entries are not allowed'; end if;
  if coalesce(cardinality(p_tags), 0) > 8 then raise exception 'Maximum eight tags'; end if;

  insert into public.entries(user_id, date, emoji, note)
  values (v_user, p_date, p_emoji, nullif(btrim(p_note), ''))
  on conflict (user_id, date) do update set emoji = excluded.emoji, note = excluded.note
  returning id into v_entry;

  delete from public.entry_tags where entry_id = v_entry;
  foreach v_name in array coalesce(p_tags, array[]::text[]) loop
    v_name := lower(btrim(v_name));
    if v_name = '' or char_length(v_name) > 24 then raise exception 'Invalid tag'; end if;
    insert into public.tags(user_id, name) values (v_user, v_name)
    on conflict (user_id, name) do update set name = excluded.name
    returning id into v_tag;
    insert into public.entry_tags(entry_id, tag_id) values (v_entry, v_tag)
    on conflict do nothing;
  end loop;
  return v_entry;
end;
$$;
revoke all on function public.save_mood_entry(date, text, text, text[]) from public, anon;
grant execute on function public.save_mood_entry(date, text, text, text[]) to authenticated;
