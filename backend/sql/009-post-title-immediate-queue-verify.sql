\set ON_ERROR_STOP on
\pset pager off

SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'posts'
  AND column_name = 'title';

SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'posts'::regclass
  AND conname = 'posts_title_not_blank_check';

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'posts'
  AND indexname = 'idx_posts_title';

SELECT
  COUNT(*) AS total_posts,
  COUNT(*) FILTER (WHERE title IS NOT NULL) AS posts_with_title,
  COUNT(*) FILTER (WHERE title IS NOT NULL AND BTRIM(title) = '')
    AS invalid_blank_titles
FROM posts;
