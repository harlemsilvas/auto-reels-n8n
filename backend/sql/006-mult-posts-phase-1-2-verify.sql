\set ON_ERROR_STOP on
\pset pager off

SELECT
  current_database() AS database_name,
  current_user AS database_user,
  current_setting('server_version') AS postgres_version;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'posts'
  AND column_name IN (
    'publish_type',
    'media_type',
    'carousel_children',
    'cover_image_filename',
    'publish_options'
  )
ORDER BY ordinal_position;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'post_media_items'
ORDER BY ordinal_position;

SELECT
  conrelid::regclass AS table_name,
  conname,
  convalidated,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('posts'::regclass, 'post_media_items'::regclass)
  AND (
    conname LIKE 'posts_publish_%'
    OR conname LIKE 'posts_carousel_%'
    OR conname LIKE 'post_media_items_%'
  )
ORDER BY conrelid::regclass::text, conname;

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('posts', 'post_media_items')
  AND (
    indexname = 'idx_posts_publish_type'
    OR indexname LIKE 'idx_post_media_items_%'
    OR indexname = 'uq_post_media_items_post_sort_active'
  )
ORDER BY tablename, indexname;

SELECT
  COUNT(*) AS posts_total,
  COUNT(*) FILTER (WHERE publish_type = 'reel') AS reel_posts,
  COUNT(*) FILTER (WHERE publish_type IS NULL) AS posts_without_publish_type,
  COUNT(*) FILTER (
    WHERE publish_type NOT IN (
      'reel',
      'feed_image',
      'feed_carousel',
      'story_image',
      'story_video'
    )
  ) AS posts_with_invalid_publish_type
FROM posts;

SELECT
  COUNT(*) AS media_items_total,
  COUNT(*) FILTER (WHERE p.id IS NULL) AS orphan_post_items,
  COUNT(*) FILTER (WHERE w.id IS NULL) AS orphan_workspace_items,
  COUNT(*) FILTER (
    WHERE p.id IS NOT NULL
      AND p.workspace_id IS DISTINCT FROM pmi.workspace_id
  ) AS workspace_mismatches
FROM post_media_items pmi
LEFT JOIN posts p ON p.id = pmi.post_id
LEFT JOIN workspaces w ON w.id = pmi.workspace_id;
