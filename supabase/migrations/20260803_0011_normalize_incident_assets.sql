-- Separate vehicle plates from internal asset codes in fleet incidents.

alter table analytics.fact_incidencias_flota
add column if not exists asset_code text;

create index if not exists idx_fact_incidencias_asset_code
on analytics.fact_incidencias_flota (asset_code);

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
  asset_code
from analytics.fact_incidencias_flota
group by month_key, area, center, vehicle_plate, provider, breakdown_type, breakdown_subgroup, is_garbigunes_scope, asset_code;

create or replace view analytics.v_vehicle_monthly_context as
select
  coalesce(s.month_key, i.month_key) as month_key,
  coalesce(s.vehicle_plate, i.vehicle_plate) as vehicle_plate,
  max(f.brand) as brand,
  max(f.model) as model,
  max(f.fuel) as fuel,
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
  where is_garbigunes_scope and vehicle_plate is not null
  group by month_key, vehicle_plate
) i
on s.month_key = i.month_key and s.vehicle_plate = i.vehicle_plate
left join analytics.dim_flota f
on f.vehicle_plate = coalesce(s.vehicle_plate, i.vehicle_plate)
group by coalesce(s.month_key, i.month_key), coalesce(s.vehicle_plate, i.vehicle_plate);

create or replace view analytics.v_incident_asset_code_quality as
select
  case
    when vehicle_plate is not null then 'vehicle_plate'
    when asset_code is not null then 'asset_code'
    else 'unidentified'
  end as identifier_type,
  count(*)::integer as incidents,
  count(distinct coalesce(vehicle_plate, asset_code, vehicle_description))::integer as distinct_identifiers
from analytics.fact_incidencias_flota
group by
  case
    when vehicle_plate is not null then 'vehicle_plate'
    when asset_code is not null then 'asset_code'
    else 'unidentified'
  end;

comment on column analytics.fact_incidencias_flota.asset_code is 'Internal asset or equipment code extracted from Vehículo/maquinaria when it is not a vehicle plate, for example C0392.';
comment on view analytics.v_incident_asset_code_quality is 'Counts incidents by normalized identifier type: vehicle plate, internal asset code or unidentified.';

grant usage on schema analytics to service_role;
grant all privileges on all tables in schema analytics to service_role;
grant all privileges on all sequences in schema analytics to service_role;
grant select on all tables in schema analytics to anon, authenticated;
