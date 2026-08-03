-- Editable correction workflow for AW weight anomalies.

create table if not exists analytics.quality_aw_weight_corrections (
  correction_id bigserial primary key,
  anomaly_id bigint not null references analytics.quality_aw_weight_anomalies(id) on delete cascade,
  original_kg numeric(20, 3) not null,
  corrected_kg numeric(14, 3) not null,
  client_response text,
  reviewed_by text,
  reviewed_at timestamptz not null default now(),
  correction_status text not null default 'applied',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_aw_weight_corrections_unique_anomaly unique (anomaly_id),
  constraint quality_aw_weight_corrections_corrected_nonnegative check (corrected_kg >= 0),
  constraint quality_aw_weight_corrections_status_check check (correction_status in ('draft', 'applied', 'rejected'))
);

drop trigger if exists quality_aw_weight_corrections_touch_updated_at on analytics.quality_aw_weight_corrections;

create trigger quality_aw_weight_corrections_touch_updated_at
before update on analytics.quality_aw_weight_corrections
for each row execute function analytics.touch_updated_at();

create index if not exists idx_quality_aw_weight_corrections_anomaly
on analytics.quality_aw_weight_corrections (anomaly_id);

create index if not exists idx_quality_aw_weight_corrections_status
on analytics.quality_aw_weight_corrections (correction_status);

create index if not exists idx_quality_aw_weight_corrections_reviewed_at
on analytics.quality_aw_weight_corrections (reviewed_at desc);

create or replace view analytics.v_aw_weight_anomalies_review as
select
  anomalies.id as anomaly_id,
  anomalies.source_file,
  anomalies.source_sheet,
  anomalies.source_row,
  anomalies.anomaly_date,
  anomalies.garbigune,
  anomalies.site_key,
  anomalies.residuo_aw,
  anomalies.familia_aw,
  anomalies.subfamilia_aw,
  anomalies.user_type,
  anomalies.origin_municipality,
  anomalies.account_municipality,
  anomalies.cp,
  anomalies.unit,
  anomalies.original_kg,
  anomalies.validated_kg,
  corrections.corrected_kg,
  case
    when corrections.correction_status = 'applied' then corrections.corrected_kg
    else anomalies.validated_kg
  end as effective_kg,
  anomalies.threshold_kg,
  anomalies.reason,
  anomalies.client_question,
  anomalies.proposed_action,
  anomalies.review_status as anomaly_review_status,
  corrections.correction_status,
  case
    when corrections.correction_status = 'applied' then 'corrected'
    when corrections.correction_status = 'rejected' then 'discarded'
    else anomalies.review_status
  end as effective_review_status,
  coalesce(corrections.client_response, anomalies.client_response) as client_response,
  corrections.reviewed_by,
  coalesce(corrections.reviewed_at, anomalies.reviewed_at) as reviewed_at,
  corrections.notes as correction_notes,
  anomalies.loaded_at
from analytics.quality_aw_weight_anomalies anomalies
left join analytics.quality_aw_weight_corrections corrections
on corrections.anomaly_id = anomalies.id;

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
  case when count(*) filter (where effective_review_status = 'pending') > 0 then 'warning' else 'info' end as severity,
  count(*) filter (where effective_review_status = 'pending')::numeric as threshold_value,
  'rows' as threshold_unit,
  'Revisar con cliente los pesos AW en cuarentena' as action,
  'Entradas AW conservadas en conteos con peso efectivo 0 kg hasta correccion o confirmacion.' as description,
  true as active
from analytics.v_aw_weight_anomalies_review
union all
select
  'aw_weight_corrections_applied' as rule_key,
  'captacion_aw' as domain,
  'applied_corrections' as metric,
  'info' as severity,
  count(*) filter (where correction_status = 'applied')::numeric as threshold_value,
  'rows' as threshold_unit,
  'Aplicar pesos corregidos en agregados analiticos cuando se cierre el criterio de recalculo' as action,
  'Correcciones AW registradas con respuesta de cliente, revisor y fecha.' as description,
  true as active
from analytics.v_aw_weight_anomalies_review;

comment on table analytics.quality_aw_weight_corrections is 'Editable correction workflow for AW weight anomalies validated with the client.';
comment on view analytics.v_aw_weight_anomalies_review is 'AW weight anomalies enriched with correction status and effective kg for review workflows.';

grant usage on schema analytics to service_role;
grant all privileges on all tables in schema analytics to service_role;
grant all privileges on all sequences in schema analytics to service_role;
grant select on all tables in schema analytics to anon, authenticated;
