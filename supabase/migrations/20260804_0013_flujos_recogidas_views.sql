-- Reusable analytical views for the Flujos y recogidas axis.
-- They deliberately expose analytical building blocks, not dashboard cards.

create or replace view analytics.v_flujos_salidas_mensual as
select
  s.month_key,
  s.site_key,
  s.garbigune,
  coalesce(g.es_movil, false) as es_movil,
  coalesce(nullif(trim(s.base), ''), 'SIN BASE') as base,
  coalesce(nullif(trim(s.route_name), ''), 'SIN RUTA') as route_name,
  s.residuo,
  count(*)::integer as services,
  count(distinct s.service_date)::integer as active_days,
  min(s.service_date) as first_service_date,
  max(s.service_date) as last_service_date,
  sum(s.kg)::numeric(16, 3) as kg,
  (sum(s.kg) / 1000)::numeric(16, 3) as tons,
  avg(s.kg)::numeric(16, 3) as avg_kg_per_service,
  stddev_samp(s.kg)::numeric(16, 3) as stddev_kg_per_service,
  percentile_cont(0.5) within group (order by s.kg)::numeric(16, 3) as median_kg_per_service
from analytics.fact_salidas_transporte s
left join analytics.dim_garbigunes g on g.site_key = s.site_key
group by
  s.month_key,
  s.site_key,
  s.garbigune,
  g.es_movil,
  coalesce(nullif(trim(s.base), ''), 'SIN BASE'),
  coalesce(nullif(trim(s.route_name), ''), 'SIN RUTA'),
  s.residuo;

create or replace view analytics.v_flujos_rutas_mensual as
select
  s.month_key,
  coalesce(nullif(trim(s.base), ''), 'SIN BASE') as base,
  coalesce(nullif(trim(s.route_name), ''), 'SIN RUTA') as route_name,
  count(distinct coalesce(s.site_key, s.garbigune))::integer as sites_served,
  count(distinct s.residuo)::integer as waste_types,
  count(*)::integer as services,
  count(distinct s.service_date)::integer as active_days,
  min(s.service_date) as first_service_date,
  max(s.service_date) as last_service_date,
  sum(s.kg)::numeric(16, 3) as kg,
  (sum(s.kg) / 1000)::numeric(16, 3) as tons,
  avg(s.kg)::numeric(16, 3) as avg_kg_per_service,
  stddev_samp(s.kg)::numeric(16, 3) as stddev_kg_per_service,
  percentile_cont(0.5) within group (order by s.kg)::numeric(16, 3) as median_kg_per_service,
  case
    when count(*) > 1 and avg(s.kg) > 0 then (stddev_samp(s.kg) / avg(s.kg))::numeric(16, 4)
    else null
  end as coefficient_variation_kg
from analytics.fact_salidas_transporte s
group by
  s.month_key,
  coalesce(nullif(trim(s.base), ''), 'SIN BASE'),
  coalesce(nullif(trim(s.route_name), ''), 'SIN RUTA');

create or replace view analytics.v_flujos_cadencia_diaria as
with daily_services as (
  select
    s.service_date,
    s.month_key,
    s.site_key,
    coalesce(s.site_key, s.garbigune) as point_key,
    max(s.garbigune) as garbigune,
    s.residuo,
    count(*)::integer as services,
    sum(s.kg)::numeric(16, 3) as kg
  from analytics.fact_salidas_transporte s
  group by s.service_date, s.month_key, s.site_key, coalesce(s.site_key, s.garbigune), s.residuo
),
with_intervals as (
  select
    daily_services.*,
    service_date - lag(service_date) over (
      partition by point_key, residuo
      order by service_date
    ) as days_since_previous_service
  from daily_services
)
select
  service_date,
  month_key,
  site_key,
  point_key,
  garbigune,
  residuo,
  services,
  kg,
  (kg / 1000)::numeric(16, 3) as tons,
  days_since_previous_service::integer
from with_intervals;

create or replace view analytics.v_flujos_cadencia_mensual as
select
  month_key,
  site_key,
  point_key,
  garbigune,
  residuo,
  count(*)::integer as active_days,
  sum(services)::integer as services,
  sum(kg)::numeric(16, 3) as kg,
  (sum(kg) / 1000)::numeric(16, 3) as tons,
  min(service_date) as first_service_date,
  max(service_date) as last_service_date,
  avg(days_since_previous_service)::numeric(16, 2) as avg_days_between_services,
  max(days_since_previous_service)::integer as max_days_between_services
from analytics.v_flujos_cadencia_diaria
group by month_key, site_key, point_key, garbigune, residuo;

create or replace view analytics.v_flujos_garbigunes_mensual as
with aw as (
  select
    month_key,
    coalesce(site_key, 'RAW:' || garbigune) as point_key,
    max(site_key) as site_key,
    max(garbigune) as garbigune,
    sum(entries)::integer as aw_entries,
    sum(source_rows)::integer as aw_source_rows,
    sum(kg)::numeric(16, 3) as aw_kg
  from analytics.fact_captacion_aw
  group by month_key, coalesce(site_key, 'RAW:' || garbigune)
),
salidas as (
  select
    month_key,
    coalesce(site_key, 'RAW:' || garbigune) as point_key,
    max(site_key) as site_key,
    max(garbigune) as garbigune,
    count(*)::integer as salida_services,
    count(distinct service_date)::integer as salida_active_days,
    sum(kg)::numeric(16, 3) as salida_kg
  from analytics.fact_salidas_transporte
  group by month_key, coalesce(site_key, 'RAW:' || garbigune)
),
combined as (
  select
    coalesce(aw.month_key, salidas.month_key) as month_key,
    coalesce(aw.point_key, salidas.point_key) as point_key,
    coalesce(aw.site_key, salidas.site_key) as site_key,
    coalesce(aw.garbigune, salidas.garbigune) as garbigune,
    coalesce(aw.aw_entries, 0)::integer as aw_entries,
    coalesce(aw.aw_source_rows, 0)::integer as aw_source_rows,
    coalesce(aw.aw_kg, 0)::numeric(16, 3) as aw_kg,
    coalesce(salidas.salida_services, 0)::integer as salida_services,
    coalesce(salidas.salida_active_days, 0)::integer as salida_active_days,
    coalesce(salidas.salida_kg, 0)::numeric(16, 3) as salida_kg
  from aw
  full outer join salidas
    on aw.month_key = salidas.month_key
   and aw.point_key = salidas.point_key
)
select
  c.month_key,
  c.point_key,
  c.site_key,
  c.garbigune,
  coalesce(g.es_movil, false) as es_movil,
  c.aw_entries,
  c.aw_source_rows,
  c.aw_kg,
  (c.aw_kg / 1000)::numeric(16, 3) as aw_tons,
  c.salida_services,
  c.salida_active_days,
  c.salida_kg,
  (c.salida_kg / 1000)::numeric(16, 3) as salida_tons,
  case when c.salida_services > 0 then (c.salida_kg / c.salida_services)::numeric(16, 3) end as avg_kg_per_service
from combined c
left join analytics.dim_garbigunes g on g.site_key = c.site_key;

create or replace view analytics.v_flujos_balance_mensual as
select
  balance.month_key,
  balance.site_key,
  g.garbigune,
  coalesce(g.es_movil, false) as es_movil,
  balance.familia_aw,
  balance.aw_entries,
  balance.aw_kg,
  balance.aw_tons,
  balance.salida_kg,
  balance.salida_tons,
  balance.salida_source_kg,
  balance.salida_source_tons,
  (balance.aw_kg - balance.salida_kg)::numeric(16, 3) as balance_kg,
  ((balance.aw_kg - balance.salida_kg) / 1000)::numeric(16, 3) as balance_tons,
  case
    when balance.aw_kg > 0 and balance.salida_kg > 0 then 'comparable'
    when balance.aw_kg > 0 then 'only_aw_entries'
    when balance.salida_kg > 0 then 'only_transport_output'
    else 'no_activity'
  end as coverage_status
from analytics.v_aw_vs_salidas_family_monthly balance
left join analytics.dim_garbigunes g on g.site_key = balance.site_key;

-- Browser-safe variants: no driver names, vehicle plates, source rows or raw records.
create or replace view analytics.v_public_flujos_salidas_mensual as
select * from analytics.v_flujos_salidas_mensual;

create or replace view analytics.v_public_flujos_rutas_mensual as
select * from analytics.v_flujos_rutas_mensual;

create or replace view analytics.v_public_flujos_cadencia_mensual as
select * from analytics.v_flujos_cadencia_mensual;

create or replace view analytics.v_public_flujos_garbigunes_mensual as
select
  month_key,
  point_key,
  site_key,
  garbigune,
  es_movil,
  aw_entries,
  aw_kg,
  aw_tons,
  salida_services,
  salida_active_days,
  salida_kg,
  salida_tons,
  avg_kg_per_service
from analytics.v_flujos_garbigunes_mensual;

create or replace view analytics.v_public_flujos_balance_mensual as
select * from analytics.v_flujos_balance_mensual;

grant select on
  analytics.v_public_flujos_salidas_mensual,
  analytics.v_public_flujos_rutas_mensual,
  analytics.v_public_flujos_cadencia_mensual,
  analytics.v_public_flujos_garbigunes_mensual,
  analytics.v_public_flujos_balance_mensual
to anon, authenticated;

comment on view analytics.v_flujos_salidas_mensual is 'Monthly outgoing transport aggregate by point, route, base and waste. Reusable for flow, load and waste analysis.';
comment on view analytics.v_flujos_rutas_mensual is 'Monthly operational route profile: volume, active days, sites, waste breadth and load variability.';
comment on view analytics.v_flujos_cadencia_diaria is 'Daily outgoing-service cadence by point and waste. The first observed service has null interval.';
comment on view analytics.v_flujos_cadencia_mensual is 'Monthly cadence aggregate by point and waste, including observed intervals between service days.';
comment on view analytics.v_flujos_garbigunes_mensual is 'Monthly incoming AW and outgoing transport context by Garbigune; values are not a balance across waste families.';
comment on view analytics.v_flujos_balance_mensual is 'Monthly AW vs weighted outgoing transport comparison by point and AW family; balance is a record contrast, not stock.';
comment on view analytics.v_public_flujos_salidas_mensual is 'Browser-facing monthly outgoing transport aggregate without drivers or vehicle plates.';
comment on view analytics.v_public_flujos_rutas_mensual is 'Browser-facing monthly route profile without drivers or vehicle plates.';
comment on view analytics.v_public_flujos_cadencia_mensual is 'Browser-facing monthly service cadence without drivers or vehicle plates.';
comment on view analytics.v_public_flujos_garbigunes_mensual is 'Browser-facing monthly Garbigune context without raw source-row counts.';
comment on view analytics.v_public_flujos_balance_mensual is 'Browser-facing monthly weighted AW/output comparison by family.';
