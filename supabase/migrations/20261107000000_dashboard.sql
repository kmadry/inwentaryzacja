-- Dashboard wagi magazynowej.
-- Idempotentna: można uruchomić wielokrotnie (SQL Editor w Supabase lub `supabase db push`).

-- 1. stations: RLS włączone, bez polityk dla anon/authenticated.
--    Zapis i odczyt kalibracji wyłącznie przez klucz secret / service_role (omija RLS).
alter table public.stations enable row level security;

-- 2. Data ostatniego tarowania.
alter table public.stations add column if not exists tared_at timestamptz;

-- 3. Widok z gramami i czasem zdarzenia.
--    drop + create (a nie create or replace), bo typ kolumny grams w starym widoku może być inny.
--    security_invoker = true: widok respektuje RLS tabel bazowych (anon nie odczyta przez niego danych).
drop view if exists public.readings_g;
create view public.readings_g
with (security_invoker = true) as
select
  r.id,
  r.station_id,
  r.raw,
  r.created_at,
  round((r.raw - s.offset_raw) / s.raw_per_g) as grams,
  r.measured_at,
  coalesce(r.measured_at, r.created_at) as event_at
from public.readings r
join public.stations s on s.id = r.station_id;

revoke all on public.readings_g from anon, authenticated;

-- 4. Indeks pod zapytania dashboardu (okno 24 h, ostatnie odczyty).
create index if not exists readings_station_created_idx on public.readings (station_id, created_at);
