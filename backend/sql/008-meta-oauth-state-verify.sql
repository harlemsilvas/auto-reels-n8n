\set ON_ERROR_STOP on
\pset pager off

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'socialbot_oauth_states'
ORDER BY ordinal_position;

SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'socialbot_oauth_states'::regclass
ORDER BY conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'socialbot_oauth_states'
ORDER BY indexname;

SELECT
  COUNT(*) AS total_states,
  COUNT(*) FILTER (
    WHERE consumed_at IS NULL AND expires_at > NOW()
  ) AS active_states
FROM socialbot_oauth_states;
