-- Initial analytical schema for the Garbigunes dashboard.
-- Intended for Supabase Postgres.

create schema if not exists analytics;

create or replace function analytics.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists analytics.dim_garbigunes (
  site_key text primary key,
  garbigune text not null,
  codigo_postal text,
  direccion text,
  lat double precision,
  lon double precision,
  fuente text,
  es_movil boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dim_garbigunes_lat_range check (lat is null or lat between -90 and 90),
  constraint dim_garbigunes_lon_range check (lon is null or lon between -180 and 180)
);

drop trigger if exists dim_garbigunes_touch_updated_at on analytics.dim_garbigunes;

create trigger dim_garbigunes_touch_updated_at
before update on analytics.dim_garbigunes
for each row execute function analytics.touch_updated_at();

create table if not exists analytics.config_familias_aw (
  residuo_aw text primary key,
  familia_aw text not null,
  subfamilia_aw text not null default 'SIN SUBFAMILIA',
  descripcion_familia text,
  ejemplos text,
  criterio text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_config_familias_aw_familia
on analytics.config_familias_aw (familia_aw, subfamilia_aw);

drop trigger if exists config_familias_aw_touch_updated_at on analytics.config_familias_aw;

create trigger config_familias_aw_touch_updated_at
before update on analytics.config_familias_aw
for each row execute function analytics.touch_updated_at();

create table if not exists analytics.fact_salidas_transporte (
  id bigserial primary key,
  service_date date not null,
  month_key text not null,
  garbigune text not null,
  residuo text not null,
  vehicle_plate text,
  driver_name text,
  base text,
  route_name text,
  kg numeric(14, 3) not null default 0,
  source_file text,
  source_row_hash text,
  loaded_at timestamptz not null default now(),
  constraint fact_salidas_month_key_format check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint fact_salidas_kg_nonnegative check (kg >= 0)
);

create index if not exists idx_fact_salidas_date
on analytics.fact_salidas_transporte (service_date);

create index if not exists idx_fact_salidas_month
on analytics.fact_salidas_transporte (month_key);

create index if not exists idx_fact_salidas_garbigune
on analytics.fact_salidas_transporte (garbigune);

create index if not exists idx_fact_salidas_residuo
on analytics.fact_salidas_transporte (residuo);

create index if not exists idx_fact_salidas_vehicle
on analytics.fact_salidas_transporte (vehicle_plate);

create index if not exists idx_fact_salidas_driver
on analytics.fact_salidas_transporte (driver_name);

create index if not exists idx_fact_salidas_route
on analytics.fact_salidas_transporte (route_name);

create index if not exists idx_fact_salidas_main_filter
on analytics.fact_salidas_transporte (service_date, garbigune, residuo);

create table if not exists analytics.fact_captacion_aw (
  id bigserial primary key,
  entry_date date not null,
  month_key text not null,
  garbigune text not null,
  site_key text,
  residuo_aw text not null,
  familia_aw text not null default 'SIN FAMILIA',
  subfamilia_aw text not null default 'SIN SUBFAMILIA',
  user_type text,
  origin_municipality text,
  account_municipality text,
  cp text,
  unit text,
  site_has_location boolean,
  kg numeric(14, 3) not null default 0,
  source_rows integer not null default 0,
  entries integer not null default 0,
  source_file text,
  source_row_hash text,
  loaded_at timestamptz not null default now(),
  constraint fact_captacion_month_key_format check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint fact_captacion_kg_nonnegative check (kg >= 0),
  constraint fact_captacion_source_rows_nonnegative check (source_rows >= 0),
  constraint fact_captacion_entries_nonnegative check (entries >= 0)
);

create index if not exists idx_fact_captacion_date
on analytics.fact_captacion_aw (entry_date);

create index if not exists idx_fact_captacion_month
on analytics.fact_captacion_aw (month_key);

create index if not exists idx_fact_captacion_site
on analytics.fact_captacion_aw (site_key, garbigune);

create index if not exists idx_fact_captacion_residuo
on analytics.fact_captacion_aw (residuo_aw);

create index if not exists idx_fact_captacion_familia
on analytics.fact_captacion_aw (familia_aw, subfamilia_aw);

create index if not exists idx_fact_captacion_user_type
on analytics.fact_captacion_aw (user_type);

create index if not exists idx_fact_captacion_cp
on analytics.fact_captacion_aw (cp);

create index if not exists idx_fact_captacion_main_filter
on analytics.fact_captacion_aw (entry_date, site_key, familia_aw, cp);

comment on schema analytics is 'Analytical schema for Garbigunes dashboard data.';
comment on table analytics.fact_salidas_transporte is 'Transported outgoing waste services from Garbigunes weighing records. One row per transport service.';
comment on table analytics.fact_captacion_aw is 'Aggregated AW entries by date, Garbigune, waste, user type and origin postal code.';
comment on table analytics.dim_garbigunes is 'Garbigune master data, including locations and mobile/fixed flag.';
comment on table analytics.config_familias_aw is 'Editable AW waste family and subfamily taxonomy.';
