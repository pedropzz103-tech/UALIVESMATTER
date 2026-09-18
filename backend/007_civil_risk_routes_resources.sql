-- Civil risk zones, evacuation points and verified help resources
create table if not exists public.civil_risk_zones (
  id uuid primary key default gen_random_uuid(),
  name_uk text not null,
  name_ru text,
  name_en text,
  severity smallint not null check (severity between 1 and 3),
  geojson jsonb not null,
  source_name text,
  source_url text,
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evacuation_points (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('shelter','transport','aid','hospital','evacuation')),
  name_uk text not null,
  name_ru text,
  name_en text,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'unknown' check (status in ('open','closed','limited','unknown')),
  source_name text,
  source_url text,
  verified boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.verified_resources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('charity','help','official')),
  name text not null,
  description_uk text,
  description_ru text,
  description_en text,
  url text not null,
  verified boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.civil_risk_zones enable row level security;
alter table public.evacuation_points enable row level security;
alter table public.verified_resources enable row level security;

drop policy if exists civil_risk_zones_read on public.civil_risk_zones;
create policy civil_risk_zones_read on public.civil_risk_zones
for select to authenticated
using (active = true and (valid_until is null or valid_until > now()));

drop policy if exists evacuation_points_read on public.evacuation_points;
create policy evacuation_points_read on public.evacuation_points
for select to authenticated using (true);

drop policy if exists verified_resources_read on public.verified_resources;
create policy verified_resources_read on public.verified_resources
for select to authenticated using (verified = true);

insert into public.verified_resources(kind,name,description_uk,description_ru,description_en,url,verified,sort_order)
values
('help','Ukrainian Red Cross','Гуманітарна допомога, евакуація, перша допомога та підтримка постраждалих.','Гуманитарная помощь, эвакуация, первая помощь и поддержка пострадавших.','Humanitarian aid, evacuation, first aid and support for affected people.','https://redcross.org.ua/en/',true,10),
('help','UNHCR Ukraine','Офіційна інформація про допомогу для постраждалих від війни, ВПО та людей, які залишають Україну.','Официальная информация о помощи для пострадавших от войны, ВПЛ и людей, покидающих Украину.','Official help information for war-affected people, displaced people and those leaving Ukraine.','https://help.unhcr.org/ukraine/',true,20),
('charity','UNITED24','Офіційна державна фандрейзингова платформа України.','Официальная государственная фандрайзинговая платформа Украины.','Official fundraising platform of Ukraine.','https://u24.gov.ua/',true,30)
on conflict do nothing;

create index if not exists civil_risk_zones_active_idx on public.civil_risk_zones(active, severity);
create index if not exists evacuation_points_kind_idx on public.evacuation_points(kind, status);
create index if not exists verified_resources_sort_idx on public.verified_resources(sort_order);
