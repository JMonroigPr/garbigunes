-- Permissions needed by Supabase PostgREST/API roles to access the analytics schema.
-- The data loader uses SUPABASE_SERVICE_ROLE_KEY, so service_role needs full
-- privileges on tables and sequences in analytics.

grant usage on schema analytics to service_role;
grant all privileges on all tables in schema analytics to service_role;
grant all privileges on all sequences in schema analytics to service_role;
grant execute on all functions in schema analytics to service_role;

alter default privileges in schema analytics
grant all privileges on tables to service_role;

alter default privileges in schema analytics
grant all privileges on sequences to service_role;

alter default privileges in schema analytics
grant execute on functions to service_role;

-- Optional read-only API access for a future dashboard that queries Supabase
-- with a publishable/anon key. Keep RLS policies in mind before exposing data
-- publicly from the browser.
grant usage on schema analytics to anon, authenticated;
grant select on all tables in schema analytics to anon, authenticated;

alter default privileges in schema analytics
grant select on tables to anon, authenticated;
