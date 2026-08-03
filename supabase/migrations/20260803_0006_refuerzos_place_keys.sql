-- Normalize reinforcement places for joins with Garbigunes, mobile points and transport bases.

alter table analytics.config_site_aliases
drop constraint if exists config_site_aliases_type_check;

alter table analytics.config_site_aliases
add constraint config_site_aliases_type_check
check (site_type in ('fixed', 'mobile', 'beach', 'non_fixed', 'external', 'transport_base', 'quality', 'review'));

alter table analytics.fact_refuerzos
add column if not exists place_key text,
add column if not exists place_type text,
add column if not exists site_key text;

update analytics.fact_refuerzos refuerzos
set
  place_key = aliases.site_key,
  place_type = aliases.site_type,
  site_key = case when aliases.site_type = 'fixed' then aliases.site_key else null end
from analytics.config_site_aliases aliases
where aliases.active
  and refuerzos.place_key is null
  and regexp_replace(
    translate(upper(refuerzos.place), 'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ', 'AEIOUAEIOUAEIOUN'),
    '[^A-Z0-9]+',
    ' ',
    'g'
  ) = regexp_replace(
    translate(upper(aliases.raw_name), 'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ', 'AEIOUAEIOUAEIOUN'),
    '[^A-Z0-9]+',
    ' ',
    'g'
  );

update analytics.fact_refuerzos
set
  place_key = coalesce(place_key, regexp_replace(translate(upper(place), 'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ', 'AEIOUAEIOUAEIOUN'), '[^A-Z0-9]+', ' ', 'g')),
  place_type = coalesce(place_type, 'review')
where place_key is null or place_type is null;

create index if not exists idx_fact_refuerzos_place_key
on analytics.fact_refuerzos (place_key);

create index if not exists idx_fact_refuerzos_site_key
on analytics.fact_refuerzos (site_key);

create index if not exists idx_fact_refuerzos_place_type
on analytics.fact_refuerzos (place_type);

create or replace view analytics.v_refuerzos_monthly as
select
  month_key,
  place,
  place_key,
  place_type,
  site_key,
  reason,
  covered_by,
  count(*)::integer as reinforcements
from analytics.fact_refuerzos
group by month_key, place, place_key, place_type, site_key, reason, covered_by;

comment on column analytics.fact_refuerzos.place_key is 'Normalized place key for fixed Garbigunes, mobile points, non-fixed points and transport bases.';
comment on column analytics.fact_refuerzos.place_type is 'Place classification: fixed, mobile, beach, non_fixed, external, transport_base, quality or review.';
comment on column analytics.fact_refuerzos.site_key is 'dim_garbigunes.site_key when the reinforcement place maps to a fixed Garbigune.';

grant usage on schema analytics to service_role;
grant all privileges on all tables in schema analytics to service_role;
grant all privileges on all sequences in schema analytics to service_role;
grant select on all tables in schema analytics to anon, authenticated;
