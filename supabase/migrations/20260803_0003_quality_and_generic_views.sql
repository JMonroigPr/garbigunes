-- Quality, fleet/resource facts and low-coupling analytical views.

create table if not exists analytics.config_quality_rules (
  rule_key text primary key,
  domain text not null,
  metric text not null,
  severity text not null default 'warning',
  threshold_value numeric(20, 6),
  threshold_unit text,
  action text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint config_quality_rules_severity_check check (severity in ('info', 'warning', 'critical'))
);

drop trigger if exists config_quality_rules_touch_updated_at on analytics.config_quality_rules;

create trigger config_quality_rules_touch_updated_at
before update on analytics.config_quality_rules
for each row execute function analytics.touch_updated_at();

create table if not exists analytics.quality_aw_weight_anomalies (
  id bigserial primary key,
  source_file text not null,
  source_sheet text,
  source_row integer,
  anomaly_date date,
  garbigune text,
  site_key text,
  residuo_aw text,
  familia_aw text,
  subfamilia_aw text,
  user_type text,
  origin_municipality text,
  account_municipality text,
  cp text,
  unit text,
  original_kg numeric(20, 3) not null,
  validated_kg numeric(14, 3) not null default 0,
  threshold_kg numeric(14, 3),
  reason text,
  client_question text,
  proposed_action text,
  review_status text not null default 'pending',
  client_response text,
  reviewed_at timestamptz,
  loaded_at timestamptz not null default now(),
  constraint quality_aw_weight_review_status_check check (review_status in ('pending', 'confirmed', 'corrected', 'discarded')),
  constraint quality_aw_weight_validated_nonnegative check (validated_kg >= 0)
);

create index if not exists idx_quality_aw_weight_date
on analytics.quality_aw_weight_anomalies (anomaly_date);

create index if not exists idx_quality_aw_weight_site
on analytics.quality_aw_weight_anomalies (site_key, garbigune);

create index if not exists idx_quality_aw_weight_status
on analytics.quality_aw_weight_anomalies (review_status);

create table if not exists analytics.dim_flota (
  vehicle_plate text primary key,
  brand text,
  model text,
  fuel text,
  center text,
  service text,
  registration_date date,
  observations text,
  source_file text,
  active boolean not null default true,
  loaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists dim_flota_touch_updated_at on analytics.dim_flota;

create trigger dim_flota_touch_updated_at
before update on analytics.dim_flota
for each row execute function analytics.touch_updated_at();

create table if not exists analytics.fact_incidencias_flota (
  id bigserial primary key,
  incident_date date,
  month_key text,
  year integer,
  area text,
  center text,
  vehicle_plate text,
  vehicle_description text,
  fuel text,
  provider text,
  breakdown_type text,
  breakdown_subgroup text,
  breakdown_subsubgroup text,
  amount numeric(14, 2),
  amount_without_vat numeric(14, 2),
  incident_code text,
  delivery_note text,
  warranty text,
  warranty_end_date date,
  status text,
  has_invoice text,
  framework_agreement text,
  lot text,
  is_garbigunes_scope boolean not null default false,
  source_file text,
  loaded_at timestamptz not null default now(),
  constraint fact_incidencias_month_key_format check (month_key is null or month_key ~ '^[0-9]{4}-[0-9]{2}$')
);

create index if not exists idx_fact_incidencias_date
on analytics.fact_incidencias_flota (incident_date);

create index if not exists idx_fact_incidencias_month
on analytics.fact_incidencias_flota (month_key);

create index if not exists idx_fact_incidencias_plate
on analytics.fact_incidencias_flota (vehicle_plate);

create index if not exists idx_fact_incidencias_scope
on analytics.fact_incidencias_flota (is_garbigunes_scope, area);

create table if not exists analytics.fact_refuerzos (
  id bigserial primary key,
  reinforcement_date date,
  month_key text,
  year integer,
  covered_by text,
  place text,
  reason text,
  author text,
  notes text,
  source_file text,
  loaded_at timestamptz not null default now(),
  constraint fact_refuerzos_month_key_format check (month_key is null or month_key ~ '^[0-9]{4}-[0-9]{2}$')
);

create index if not exists idx_fact_refuerzos_date
on analytics.fact_refuerzos (reinforcement_date);

create index if not exists idx_fact_refuerzos_month
on analytics.fact_refuerzos (month_key);

create index if not exists idx_fact_refuerzos_place
on analytics.fact_refuerzos (place);

create or replace view analytics.v_salidas_monthly as
select
  month_key,
  garbigune,
  residuo,
  vehicle_plate,
  driver_name,
  base,
  route_name,
  count(*)::integer as services,
  sum(kg)::numeric(16, 3) as kg,
  (sum(kg) / 1000)::numeric(16, 3) as tons,
  avg(kg)::numeric(14, 3) as avg_kg_per_service
from analytics.fact_salidas_transporte
group by month_key, garbigune, residuo, vehicle_plate, driver_name, base, route_name;

create or replace view analytics.v_aw_monthly as
select
  month_key,
  garbigune,
  site_key,
  cp,
  residuo_aw,
  familia_aw,
  subfamilia_aw,
  user_type,
  unit,
  sum(entries)::integer as entries,
  sum(source_rows)::integer as source_rows,
  sum(kg)::numeric(16, 3) as kg,
  (sum(kg) / 1000)::numeric(16, 3) as tons
from analytics.fact_captacion_aw
group by month_key, garbigune, site_key, cp, residuo_aw, familia_aw, subfamilia_aw, user_type, unit;

create or replace view analytics.v_aw_cp_flows as
select
  month_key,
  cp,
  garbigune,
  site_key,
  familia_aw,
  subfamilia_aw,
  user_type,
  sum(entries)::integer as entries,
  sum(source_rows)::integer as source_rows,
  sum(kg)::numeric(16, 3) as kg,
  (sum(kg) / 1000)::numeric(16, 3) as tons
from analytics.fact_captacion_aw
where cp is not null and cp <> ''
group by month_key, cp, garbigune, site_key, familia_aw, subfamilia_aw, user_type;

create or replace view analytics.v_incidencias_monthly as
select
  month_key,
  area,
  center,
  vehicle_plate,
  provider,
  breakdown_type,
  breakdown_subgroup,
  is_garbigunes_scope,
  count(*)::integer as incidents,
  sum(coalesce(amount, 0))::numeric(16, 2) as amount,
  sum(coalesce(amount_without_vat, 0))::numeric(16, 2) as amount_without_vat
from analytics.fact_incidencias_flota
group by month_key, area, center, vehicle_plate, provider, breakdown_type, breakdown_subgroup, is_garbigunes_scope;

create or replace view analytics.v_refuerzos_monthly as
select
  month_key,
  place,
  reason,
  covered_by,
  count(*)::integer as reinforcements
from analytics.fact_refuerzos
group by month_key, place, reason, covered_by;

create or replace view analytics.v_vehicle_monthly_context as
select
  coalesce(s.month_key, i.month_key) as month_key,
  coalesce(s.vehicle_plate, i.vehicle_plate) as vehicle_plate,
  max(f.brand) as brand,
  max(f.model) as model,
  max(f.fuel) as fuel,
  max(f.center) as center,
  coalesce(sum(s.services), 0)::integer as services,
  coalesce(sum(s.kg), 0)::numeric(16, 3) as kg,
  coalesce(sum(i.incidents), 0)::integer as incidents,
  coalesce(sum(i.amount), 0)::numeric(16, 2) as incident_amount
from (
  select month_key, vehicle_plate, count(*)::integer as services, sum(kg)::numeric(16, 3) as kg
  from analytics.fact_salidas_transporte
  group by month_key, vehicle_plate
) s
full outer join (
  select month_key, vehicle_plate, count(*)::integer as incidents, sum(coalesce(amount, 0))::numeric(16, 2) as amount
  from analytics.fact_incidencias_flota
  where is_garbigunes_scope
  group by month_key, vehicle_plate
) i
on s.month_key = i.month_key and s.vehicle_plate = i.vehicle_plate
left join analytics.dim_flota f
on f.vehicle_plate = coalesce(s.vehicle_plate, i.vehicle_plate)
group by coalesce(s.month_key, i.month_key), coalesce(s.vehicle_plate, i.vehicle_plate);

create or replace view analytics.v_quality_summary as
select
  rule_key,
  domain,
  metric,
  severity,
  threshold_value,
  threshold_unit,
  action,
  description,
  active
from analytics.config_quality_rules
union all
select
  'aw_weight_anomalies_pending' as rule_key,
  'captacion_aw' as domain,
  'pending_anomalies' as metric,
  case when count(*) filter (where review_status = 'pending') > 0 then 'warning' else 'info' end as severity,
  count(*) filter (where review_status = 'pending')::numeric as threshold_value,
  'rows' as threshold_unit,
  'Revisar con cliente los pesos AW en cuarentena' as action,
  'Entradas AW conservadas en conteos con peso validado temporalmente a 0 kg.' as description,
  true as active
from analytics.quality_aw_weight_anomalies;

comment on table analytics.config_quality_rules is 'Editable quality rules used by loaders, validation scripts and future dashboard notes.';
comment on table analytics.quality_aw_weight_anomalies is 'AW entry weight anomalies kept for client review; entries remain counted while kg is quarantined.';
comment on table analytics.dim_flota is 'Vehicle fleet master data.';
comment on table analytics.fact_incidencias_flota is 'Fleet incident records, with Garbigunes scope flag.';
comment on table analytics.fact_refuerzos is 'Transport reinforcement/coverage records.';

grant usage on schema analytics to service_role;
grant all privileges on all tables in schema analytics to service_role;
grant all privileges on all sequences in schema analytics to service_role;
grant select on all tables in schema analytics to anon, authenticated;
