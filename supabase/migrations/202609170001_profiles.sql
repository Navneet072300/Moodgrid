-- A private account profile; auth.users remains the identity authority.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text not null unique check (username ~ '^[a-z][a-z0-9_]{2,31}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(username) on public.profiles to authenticated;
create policy "Read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Rename own profile" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create function public.sync_moodgrid_profile(p_id uuid, p_email text, p_created timestamptz, p_login timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  adjectives text[] := array['cosmic','mellow','sunny','lunar','jazzy','velvet','happy','dreamy','electric','gentle'];
  animals text[] := array['otter','panda','fox','koala','owl','tiger','finch','gecko','orca','lynx'];
  candidate text;
begin
  loop
    candidate := adjectives[1 + floor(random() * 10)::int] || '_' || animals[1 + floor(random() * 10)::int]
      || '_' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);
    begin
      insert into public.profiles(id, email, username, created_at, last_sign_in_at)
      values (p_id, p_email, candidate, coalesce(p_created, now()), p_login)
      on conflict (id) do update set email = excluded.email,
        last_sign_in_at = excluded.last_sign_in_at, updated_at = now();
      return;
    exception when unique_violation then
      -- Retry a rare generated username collision without blocking signup.
    end;
  end loop;
end;
$$;
revoke all on function public.sync_moodgrid_profile(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;

create function public.handle_moodgrid_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_moodgrid_profile(new.id, new.email, new.created_at, new.last_sign_in_at);
  return new;
end;
$$;
revoke all on function public.handle_moodgrid_auth_user() from public, anon, authenticated;
create trigger moodgrid_auth_profile after insert or update of email, last_sign_in_at on auth.users
for each row execute function public.handle_moodgrid_auth_user();

-- Preserve every existing account, including people who joined before this migration.
do $$
declare account record;
begin
  for account in select id, email, created_at, last_sign_in_at from auth.users loop
    perform public.sync_moodgrid_profile(account.id, account.email, account.created_at, account.last_sign_in_at);
  end loop;
end;
$$;

create function public.touch_moodgrid_profile()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function public.touch_moodgrid_profile() from public, anon, authenticated;
create trigger moodgrid_profile_updated before update on public.profiles
for each row execute function public.touch_moodgrid_profile();

alter table public.entries add constraint entries_profile_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.tags add constraint tags_profile_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
