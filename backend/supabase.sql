create extension if not exists pgcrypto;

create table if not exists public.community_alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  text text not null check (char_length(text) <= 220),
  lat double precision not null,
  lng double precision not null,
  status text not null default 'unverified',
  confirmations integer not null default 0,
  rejections integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.alert_votes (
  alert_id uuid references public.community_alerts(id) on delete cascade,
  device_id text not null,
  vote smallint not null check (vote in (-1,1)),
  created_at timestamptz not null default now(),
  primary key(alert_id, device_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'general',
  display_name text not null default 'Користувач',
  text text not null check (char_length(text) <= 280),
  device_id text not null,
  created_at timestamptz not null default now()
);

alter table public.community_alerts enable row level security;
alter table public.alert_votes enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists alerts_read on public.community_alerts;
create policy alerts_read on public.community_alerts for select using (created_at > now() - interval '48 hours');
drop policy if exists alerts_insert on public.community_alerts;
create policy alerts_insert on public.community_alerts for insert with check (true);

drop policy if exists votes_read on public.alert_votes;
create policy votes_read on public.alert_votes for select using (true);
drop policy if exists votes_write on public.alert_votes;
create policy votes_write on public.alert_votes for insert with check (true);
drop policy if exists votes_update on public.alert_votes;
create policy votes_update on public.alert_votes for update using (true) with check (true);

drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select using (created_at > now() - interval '24 hours');
drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages for insert with check (true);

create or replace function public.recount_alert_votes()
returns trigger language plpgsql security definer as $$
begin
  update public.community_alerts a set
    confirmations=(select count(*) from public.alert_votes v where v.alert_id=a.id and v.vote=1),
    rejections=(select count(*) from public.alert_votes v where v.alert_id=a.id and v.vote=-1),
    status=case when (select count(*) from public.alert_votes v where v.alert_id=a.id and v.vote=1) >= 3
                 and (select count(*) from public.alert_votes v where v.alert_id=a.id and v.vote=1) >
                     (select count(*) from public.alert_votes v where v.alert_id=a.id and v.vote=-1)
                then 'community_verified' else 'unverified' end
  where a.id=coalesce(new.alert_id,old.alert_id);
  return coalesce(new,old);
end $$;

drop trigger if exists trg_alert_votes on public.alert_votes;
create trigger trg_alert_votes after insert or update or delete on public.alert_votes
for each row execute function public.recount_alert_votes();

alter publication supabase_realtime add table public.community_alerts;
alter publication supabase_realtime add table public.alert_votes;
alter publication supabase_realtime add table public.chat_messages;
