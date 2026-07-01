\set ON_ERROR_STOP on
\pset pager off

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'socialbot_users',
    'socialbot_user_workspaces',
    'socialbot_sessions',
    'socialbot_audit_log'
  )
ORDER BY table_name;

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'socialbot_users',
    'socialbot_user_workspaces',
    'socialbot_sessions',
    'socialbot_audit_log'
  )
ORDER BY table_name, ordinal_position;

SELECT conrelid::regclass AS table_name,
       conname,
       convalidated,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
  'socialbot_users'::regclass,
  'socialbot_user_workspaces'::regclass,
  'socialbot_sessions'::regclass,
  'socialbot_audit_log'::regclass,
  'posts'::regclass,
  'post_events'::regclass
)
AND (
  conname LIKE 'socialbot_%'
  OR conname IN ('posts_created_by_user_fk', 'post_events_actor_user_fk')
)
ORDER BY conrelid::regclass::text, conname;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'socialbot_%'
    OR indexname IN ('idx_posts_created_by_user', 'idx_post_events_actor_user')
  )
ORDER BY tablename, indexname;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'posts' AND column_name = 'created_by_user_id')
    OR (table_name = 'post_events' AND column_name = 'actor_user_id')
  )
ORDER BY table_name;

SELECT
  (SELECT COUNT(*) FROM socialbot_users) AS users_count,
  (SELECT COUNT(*) FROM socialbot_sessions) AS sessions_count,
  (SELECT COUNT(*) FROM socialbot_audit_log) AS audit_count,
  (SELECT COUNT(*) FROM posts WHERE created_by_user_id IS NOT NULL)
    AS attributed_posts_count;
