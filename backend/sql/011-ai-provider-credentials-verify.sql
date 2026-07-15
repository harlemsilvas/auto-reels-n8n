\set ON_ERROR_STOP on

SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ai_provider_credentials', 'ai_provider_usage_events')
ORDER BY table_name;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ai_provider_credentials'
ORDER BY ordinal_position;

SELECT
  conname,
  convalidated
FROM pg_constraint
WHERE conrelid IN (
  'ai_provider_credentials'::regclass,
  'ai_provider_usage_events'::regclass
)
ORDER BY conname;
