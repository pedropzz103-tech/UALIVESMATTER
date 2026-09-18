create table if not exists public.utility_incidents (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('power','heating','water')),
  title text not null,
  details text,
  region text,
  lat double precision,
  lng double precision,
  status text not null default 'active' check (status in ('active','restored','scheduled')),
  starts_at timestamptz not null default now(),
  expected_restore_at timestamptz,
  source_name text,
  source_url text,
  official boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists utility_incidents_status_idx
  on public.utility_incidents(status, service, created_at desc);

alter table public.utility_incidents enable row level security;

drop policy if exists utility_incidents_read on public.utility_incidents;
create policy utility_incidents_read
on public.utility_incidents
for select
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='utility_incidents'
  ) then
    alter publication supabase_realtime add table public.utility_incidents;
  end if;
end $$;

comment on table public.utility_incidents is
'Verified/provider utility incidents for electricity, heating and water. Public clients are read-only; writes should come from trusted backend/admin integrations.';
