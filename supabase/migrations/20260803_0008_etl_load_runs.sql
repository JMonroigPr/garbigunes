-- Pipeline execution audit trail.

create table if not exists analytics.etl_load_runs (
  run_id text primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null default 'running',
  elapsed_seconds numeric(14, 2),
  schema_name text not null default 'analytics',
  tables_requested text[] not null default '{}',
  load_dry_run boolean not null default false,
  skip_build boolean not null default false,
  skip_load boolean not null default false,
  skip_validate boolean not null default false,
  build_status text,
  load_status text,
  validate_status text,
  load_counts jsonb not null default '{}'::jsonb,
  validation jsonb not null default '[]'::jsonb,
  coverage jsonb not null default '{}'::jsonb,
  active_sources jsonb not null default '{}'::jsonb,
  source_files jsonb not null default '[]'::jsonb,
  data_sources jsonb not null default '{}'::jsonb,
  log_json_path text,
  log_markdown_path text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint etl_load_runs_status_check check (status in ('running', 'ok', 'error'))
);

create index if not exists idx_etl_load_runs_finished_at
on analytics.etl_load_runs (finished_at desc);

create index if not exists idx_etl_load_runs_status
on analytics.etl_load_runs (status);

create index if not exists idx_etl_load_runs_tables_requested
on analytics.etl_load_runs using gin (tables_requested);

create or replace view analytics.v_etl_load_runs_latest as
select
  run_id,
  started_at,
  finished_at,
  status,
  elapsed_seconds,
  schema_name,
  tables_requested,
  load_dry_run,
  skip_build,
  skip_load,
  skip_validate,
  build_status,
  load_status,
  validate_status,
  load_counts,
  validation,
  coverage,
  active_sources,
  source_files,
  log_json_path,
  log_markdown_path,
  error_message
from analytics.etl_load_runs
order by started_at desc
limit 50;

create or replace view analytics.v_etl_load_runs_table_counts as
select
  runs.run_id,
  runs.started_at,
  runs.finished_at,
  runs.status,
  counts.key as table_name,
  (counts.value #>> '{}')::integer as loaded_rows
from analytics.etl_load_runs runs
cross join lateral jsonb_each(runs.load_counts) counts;

comment on table analytics.etl_load_runs is 'Audit trail for local data pipeline executions: sources, loaded row counts and validation result.';
comment on view analytics.v_etl_load_runs_latest is 'Latest data pipeline runs with compact status and source metadata.';
comment on view analytics.v_etl_load_runs_table_counts is 'One row per loaded table and pipeline run for quick load-history checks.';

grant usage on schema analytics to service_role;
grant all privileges on all tables in schema analytics to service_role;
grant all privileges on all sequences in schema analytics to service_role;
grant select on all tables in schema analytics to anon, authenticated;
