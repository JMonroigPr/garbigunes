-- Add normalized Garbigune key to outgoing transport facts.

alter table analytics.fact_salidas_transporte
add column if not exists site_key text;

update analytics.fact_salidas_transporte
set site_key = case
  when upper(garbigune) in ('AMOREBIETA ETXANO', 'AMOREBIETA-ETXANO') then 'AMOREBIETA-ETXANO'
  when upper(garbigune) in ('ORDUNA', 'ORDUÑA') then 'ORDUÑA'
  when upper(garbigune) in ('SOPELA', 'SOPELANA') then 'SOPELANA'
  when upper(garbigune) in ('GERNIKA-LUMO', 'GERNIKA LUMO') then 'GERNIKA'
  when upper(garbigune) in ('MARKINA XEMEIN', 'MARKINA-XEMEIN') then 'MARKINA'
  when upper(garbigune) in ('GUENES', 'GÜEÑES') then 'GÜEÑES'
  else regexp_replace(
    translate(
      upper(garbigune),
      'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ',
      'AEIOUAEIOUAEIOUN'
    ),
    '[^A-Z0-9]+',
    ' ',
    'g'
  )
end
where site_key is null;

create index if not exists idx_fact_salidas_site_key
on analytics.fact_salidas_transporte (site_key);

drop index if exists analytics.idx_fact_salidas_main_filter;

create index if not exists idx_fact_salidas_main_filter
on analytics.fact_salidas_transporte (service_date, site_key, residuo);

create or replace view analytics.v_salidas_monthly as
select
  month_key,
  garbigune,
  site_key,
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
group by month_key, garbigune, site_key, residuo, vehicle_plate, driver_name, base, route_name;

comment on column analytics.fact_salidas_transporte.site_key is 'Normalized Garbigune key intended to join dim_garbigunes.site_key.';
