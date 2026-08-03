-- Editable bridge between outgoing transported waste and AW waste families.

create table if not exists analytics.config_residuos_salida_aw_equivalencias (
  residuo_salida text not null,
  familia_aw text not null,
  family_rank integer not null default 1,
  criterio text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (residuo_salida, familia_aw),
  constraint config_residuos_salida_aw_rank_positive check (family_rank > 0)
);

drop trigger if exists config_residuos_salida_aw_touch_updated_at on analytics.config_residuos_salida_aw_equivalencias;

create trigger config_residuos_salida_aw_touch_updated_at
before update on analytics.config_residuos_salida_aw_equivalencias
for each row execute function analytics.touch_updated_at();

create index if not exists idx_config_residuos_salida_aw_familia
on analytics.config_residuos_salida_aw_equivalencias (familia_aw, active);

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
  sum(salidas.kg)::numeric(16, 3) as kg,
  (sum(salidas.kg) / 1000)::numeric(16, 3) as tons
from analytics.fact_salidas_transporte salidas
left join analytics.config_residuos_salida_aw_equivalencias equivalencias
on equivalencias.active
and equivalencias.residuo_salida = salidas.residuo
group by salidas.month_key, salidas.site_key, salidas.garbigune, salidas.residuo, equivalencias.familia_aw, equivalencias.family_rank, equivalencias.criterio;

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
  coalesce(sum(salidas.tons), 0)::numeric(16, 3) as salida_tons
from (
  select month_key, site_key, familia_aw, sum(entries)::integer as entries, sum(kg)::numeric(16, 3) as kg, (sum(kg) / 1000)::numeric(16, 3) as tons
  from analytics.fact_captacion_aw
  group by month_key, site_key, familia_aw
) aw
full outer join (
  select month_key, site_key, familia_aw, sum(services)::integer as services, sum(kg)::numeric(16, 3) as kg, sum(tons)::numeric(16, 3) as tons
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
  bool_or(equivalencias.active) as has_active_mapping
from (
  select distinct residuo as residuo_salida
  from analytics.fact_salidas_transporte
) residuos
left join analytics.config_residuos_salida_aw_equivalencias equivalencias
on equivalencias.residuo_salida = residuos.residuo_salida
and equivalencias.active
group by residuos.residuo_salida;

comment on table analytics.config_residuos_salida_aw_equivalencias is 'Editable bridge between outgoing transported waste categories and AW waste families.';
comment on view analytics.v_salidas_aw_family_monthly is 'Outgoing transport services grouped by AW-equivalent family.';
comment on view analytics.v_aw_vs_salidas_family_monthly is 'Generic monthly comparison between AW entries and outgoing transported waste by site and AW family.';
comment on view analytics.v_residuos_salida_aw_equivalence_quality is 'Coverage of outgoing waste categories in the AW equivalence bridge.';

grant usage on schema analytics to service_role;
grant all privileges on all tables in schema analytics to service_role;
grant all privileges on all sequences in schema analytics to service_role;
grant select on all tables in schema analytics to anon, authenticated;
