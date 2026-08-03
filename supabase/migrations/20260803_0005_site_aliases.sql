-- Editable aliases for Garbigune and non-fixed site names.

create table if not exists analytics.config_site_aliases (
  raw_name text primary key,
  site_key text not null,
  site_type text not null default 'fixed',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint config_site_aliases_type_check check (site_type in ('fixed', 'mobile', 'beach', 'non_fixed', 'external', 'transport_base', 'quality', 'review'))
);

drop trigger if exists config_site_aliases_touch_updated_at on analytics.config_site_aliases;

create trigger config_site_aliases_touch_updated_at
before update on analytics.config_site_aliases
for each row execute function analytics.touch_updated_at();

create index if not exists idx_config_site_aliases_site_key
on analytics.config_site_aliases (site_key);

create index if not exists idx_config_site_aliases_type
on analytics.config_site_aliases (site_type, active);

update analytics.fact_salidas_transporte salidas
set site_key = aliases.site_key
from analytics.config_site_aliases aliases
where aliases.active
  and salidas.site_key = aliases.raw_name;

create or replace view analytics.v_site_alias_quality as
select
  aliases.raw_name,
  aliases.site_key,
  aliases.site_type,
  aliases.active,
  aliases.notes,
  garbigunes.site_key is not null as joins_dim_garbigunes
from analytics.config_site_aliases aliases
left join analytics.dim_garbigunes garbigunes
on garbigunes.site_key = aliases.site_key;

comment on table analytics.config_site_aliases is 'Editable aliases from raw operational site names to normalized site_key values.';
comment on view analytics.v_site_alias_quality is 'Alias coverage check against dim_garbigunes.';

grant usage on schema analytics to service_role;
grant all privileges on all tables in schema analytics to service_role;
grant all privileges on all sequences in schema analytics to service_role;
grant select on all tables in schema analytics to anon, authenticated;
