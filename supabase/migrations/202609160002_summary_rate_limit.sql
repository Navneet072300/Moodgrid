-- A durable per-user cooldown, shared across Vercel instances.
create table public.summary_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.summary_rate_limits enable row level security;
revoke all on public.summary_rate_limits from anon, authenticated;

-- Callers can claim a slot, but cannot inspect or reset their cooldown.
create function public.claim_weekly_summary()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_claimed uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  insert into public.summary_rate_limits(user_id, requested_at) values (v_user, now())
  on conflict (user_id) do update set requested_at = excluded.requested_at
  where public.summary_rate_limits.requested_at <= now() - interval '60 seconds'
  returning user_id into v_claimed;
  return v_claimed is not null;
end;
$$;
revoke all on function public.claim_weekly_summary() from public, anon;
grant execute on function public.claim_weekly_summary() to authenticated;
