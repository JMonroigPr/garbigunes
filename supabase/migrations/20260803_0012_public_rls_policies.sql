-- Public API boundary for browser access with anon/publishable keys.
--
-- Principle:
-- - service_role keeps full access for ETL loads.
-- - anon/authenticated users do not read base fact tables directly.
-- - browser-facing reads use aggregated/sanitized views or safe config tables.

create or replace view analytics.v_public_salidas_monthly as
select
  month_key,
  garbigune,
  site_key,
  residuo,
  base,
  route_name,
  count(*)::integer as services,
  sum(kg)::numeric(16, 3) as kg,
  (sum(kg) / 1000)::numeric(16, 3) as tons
from analytics.fact_salidas_transporte
group by month_key, garbigune, site_key, residuo, base, route_name;

create or replace view analytics.v_public_incidencias_monthly as
select
  month_key,
  area,
  center,
  provider,
  breakdown_type,
  breakdown_subgroup,
  is_garbigunes_scope,
  count(*)::integer as incidents,
  sum(coalesce(amount, 0))::numeric(16, 2) as amount,
  sum(coalesce(amount_without_vat, 0))::numeric(16, 2) as amount_without_vat
from analytics.fact_incidencias_flota
group by month_key, area, center, provider, breakdown_type, breakdown_subgroup, is_garbigunes_scope;

create or replace view analytics.v_public_refuerzos_monthly as
select
  month_key,
  place,
  place_key,
  place_type,
  site_key,
  reason,
  count(*)::integer as reinforcements
from analytics.fact_refuerzos
group by month_key, place, place_key, place_type, site_key, reason;

alter table analytics.fact_salidas_transporte enable row level security;
alter table analytics.fact_captacion_aw enable row level security;
alter table analytics.fact_incidencias_flota enable row level security;
alter table analytics.fact_refuerzos enable row level security;
alter table analytics.dim_flota enable row level security;
alter table analytics.quality_aw_weight_anomalies enable row level security;
alter table analytics.quality_aw_weight_corrections enable row level security;
alter table analytics.etl_load_runs enable row level security;
alter table analytics.dim_garbigunes enable row level security;
alter table analytics.config_familias_aw enable row level security;
alter table analytics.config_residuos_salida_aw_equivalencias enable row level security;
alter table analytics.config_site_aliases enable row level security;
alter table analytics.config_quality_rules enable row level security;

drop policy if exists dim_garbigunes_public_select on analytics.dim_garbigunes;
create policy dim_garbigunes_public_select
on analytics.dim_garbigunes
for select
to anon, authenticated
using (true);

drop policy if exists config_familias_aw_public_select on analytics.config_familias_aw;
create policy config_familias_aw_public_select
on analytics.config_familias_aw
for select
to anon, authenticated
using (true);

drop policy if exists config_residuos_salida_aw_public_select on analytics.config_residuos_salida_aw_equivalencias;
create policy config_residuos_salida_aw_public_select
on analytics.config_residuos_salida_aw_equivalencias
for select
to anon, authenticated
using (active);

drop policy if exists config_quality_rules_public_select on analytics.config_quality_rules;
create policy config_quality_rules_public_select
on analytics.config_quality_rules
for select
to anon, authenticated
using (active);

revoke all on all tables in schema analytics from anon, authenticated;
grant usage on schema analytics to anon, authenticated;

grant select on
  analytics.dim_garbigunes,
  analytics.config_familias_aw,
  analytics.config_residuos_salida_aw_equivalencias,
  analytics.config_quality_rules,
  analytics.v_public_salidas_monthly,
  analytics.v_public_incidencias_monthly,
  analytics.v_public_refuerzos_monthly,
  analytics.v_aw_monthly,
  analytics.v_aw_cp_flows,
  analytics.v_salidas_aw_family_monthly,
  analytics.v_aw_vs_salidas_family_monthly,
  analytics.v_residuos_salida_aw_equivalence_quality,
  analytics.v_quality_summary,
  analytics.v_site_alias_quality,
  analytics.v_incident_asset_code_quality
to anon, authenticated;

grant usage on schema analytics to service_role;
grant all privileges on all tables in schema analytics to service_role;
grant all privileges on all sequences in schema analytics to service_role;

alter default privileges in schema analytics revoke select on tables from anon, authenticated;
alter default privileges in schema analytics grant all privileges on tables to service_role;
alter default privileges in schema analytics grant all privileges on sequences to service_role;

comment on view analytics.v_public_salidas_monthly is 'Public browser-facing monthly outgoing transport aggregate without driver names or vehicle plates.';
comment on view analytics.v_public_incidencias_monthly is 'Public browser-facing monthly fleet incident aggregate without vehicle plates or asset codes.';
comment on view analytics.v_public_refuerzos_monthly is 'Public browser-facing monthly reinforcement aggregate without covered-by person names.';
