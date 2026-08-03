-- Add allocation weights to outgoing waste -> AW family equivalences.

alter table analytics.config_residuos_salida_aw_equivalencias
add column if not exists allocation_weight numeric(8, 6) not null default 1;

do $$
begin
  alter table analytics.config_residuos_salida_aw_equivalencias
  add constraint config_residuos_salida_aw_weight_check
  check (allocation_weight > 0 and allocation_weight <= 1);
exception
  when duplicate_object then null;
end $$;

create or replace view analytics.v_salidas_aw_family_monthly as
select
  salidas.month_key,
  salidas.site_key,
  salidas.garbigune,
  salidas.residuo as residuo_salida,
  equivalencias.familia_aw,
  equivalencias.family_rank,
  equivalencias.criterio,
  count(*)::integer as services,
  sum(salidas.kg * coalesce(equivalencias.allocation_weight, 1))::numeric(16, 3) as kg,
  (sum(salidas.kg * coalesce(equivalencias.allocation_weight, 1)) / 1000)::numeric(16, 3) as tons,
  equivalencias.allocation_weight,
  sum(salidas.kg)::numeric(16, 3) as source_kg,
  (sum(salidas.kg) / 1000)::numeric(16, 3) as source_tons
from analytics.fact_salidas_transporte salidas
left join analytics.config_residuos_salida_aw_equivalencias equivalencias
on equivalencias.active
and equivalencias.residuo_salida = salidas.residuo
group by salidas.month_key, salidas.site_key, salidas.garbigune, salidas.residuo, equivalencias.familia_aw, equivalencias.family_rank, equivalencias.allocation_weight, equivalencias.criterio;

create or replace view analytics.v_aw_vs_salidas_family_monthly as
select
  coalesce(aw.month_key, salidas.month_key) as month_key,
  coalesce(aw.site_key, salidas.site_key) as site_key,
  coalesce(aw.familia_aw, salidas.familia_aw) as familia_aw,
  coalesce(sum(aw.entries), 0)::integer as aw_entries,
  coalesce(sum(aw.kg), 0)::numeric(16, 3) as aw_kg,
  coalesce(sum(aw.tons), 0)::numeric(16, 3) as aw_tons,
  coalesce(sum(salidas.services), 0)::integer as salida_services,
  coalesce(sum(salidas.kg), 0)::numeric(16, 3) as salida_kg,
  coalesce(sum(salidas.tons), 0)::numeric(16, 3) as salida_tons,
  coalesce(sum(salidas.source_kg), 0)::numeric(16, 3) as salida_source_kg,
  coalesce(sum(salidas.source_tons), 0)::numeric(16, 3) as salida_source_tons
from (
  select month_key, site_key, familia_aw, sum(entries)::integer as entries, sum(kg)::numeric(16, 3) as kg, (sum(kg) / 1000)::numeric(16, 3) as tons
  from analytics.fact_captacion_aw
  group by month_key, site_key, familia_aw
) aw
full outer join (
  select
    month_key,
    site_key,
    familia_aw,
    sum(services)::integer as services,
    sum(source_kg)::numeric(16, 3) as source_kg,
    sum(source_tons)::numeric(16, 3) as source_tons,
    sum(kg)::numeric(16, 3) as kg,
    sum(tons)::numeric(16, 3) as tons
  from analytics.v_salidas_aw_family_monthly
  where familia_aw is not null
  group by month_key, site_key, familia_aw
) salidas
on aw.month_key = salidas.month_key
and aw.site_key = salidas.site_key
and aw.familia_aw = salidas.familia_aw
group by coalesce(aw.month_key, salidas.month_key), coalesce(aw.site_key, salidas.site_key), coalesce(aw.familia_aw, salidas.familia_aw);

create or replace view analytics.v_residuos_salida_aw_equivalence_quality as
select
  residuos.residuo_salida,
  count(equivalencias.familia_aw)::integer as mapped_families,
  bool_or(equivalencias.active) as has_active_mapping,
  coalesce(sum(equivalencias.allocation_weight) filter (where equivalencias.active), 0)::numeric(8, 6) as active_weight_sum,
  case
    when count(equivalencias.familia_aw) filter (where equivalencias.active) = 0 then 'missing'
    when abs(coalesce(sum(equivalencias.allocation_weight) filter (where equivalencias.active), 0) - 1) <= 0.0005 then 'ok'
    else 'review_weight'
  end as weight_status
from (
  select distinct residuo as residuo_salida
  from analytics.fact_salidas_transporte
) residuos
left join analytics.config_residuos_salida_aw_equivalencias equivalencias
on equivalencias.residuo_salida = residuos.residuo_salida
and equivalencias.active
group by residuos.residuo_salida;

comment on column analytics.config_residuos_salida_aw_equivalencias.allocation_weight is 'Share of outgoing waste kg assigned to this AW family; active weights should sum to 1 by residuo_salida.';
comment on view analytics.v_salidas_aw_family_monthly is 'Outgoing transport services grouped by AW-equivalent family, with kg allocated by equivalence weight.';
comment on view analytics.v_aw_vs_salidas_family_monthly is 'Generic monthly comparison between AW entries and weighted outgoing transported waste by site and AW family.';
comment on view analytics.v_residuos_salida_aw_equivalence_quality is 'Coverage and weight quality of outgoing waste categories in the AW equivalence bridge.';

grant usage on schema analytics to service_role;
grant all privileges on all tables in schema analytics to service_role;
grant all privileges on all sequences in schema analytics to service_role;
grant select on all tables in schema analytics to anon, authenticated;
