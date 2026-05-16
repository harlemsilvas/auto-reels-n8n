-- Analise focada no lote criado pelo seed_test_posts.sql
-- Uso:
-- docker exec -i socialbot_postgres psql -U n8n -d n8n < /mnt/c/Projetos/auto-reels-n8n/scripts/sql/analyze_seed_posts.sql

\echo '=== 1) POSTS DO LOTE (mais recentes) ==='
WITH seed_posts AS (
  SELECT p.id, p.status, p.error_message, p.created_at, p.updated_at, u.stored_filename, p.caption
  FROM posts p
  LEFT JOIN uploads u ON u.id = p.upload_id
  WHERE p.caption LIKE 'Lote teste %'
  ORDER BY p.created_at DESC
  LIMIT 20
)
SELECT *
FROM seed_posts
ORDER BY created_at DESC;

\echo '=== 2) RESUMO POR STATUS DO LOTE ==='
WITH seed_posts AS (
  SELECT p.id, p.status
  FROM posts p
  WHERE p.caption LIKE 'Lote teste %'
)
SELECT status, COUNT(*) AS total
FROM seed_posts
GROUP BY status
ORDER BY total DESC, status;

\echo '=== 3) ULTIMOS EVENTOS DO LOTE ==='
WITH seed_posts AS (
  SELECT p.id
  FROM posts p
  WHERE p.caption LIKE 'Lote teste %'
  ORDER BY p.created_at DESC
  LIMIT 20
)
SELECT
  pe.post_id,
  pe.event_type,
  pe.details,
  pe.created_at
FROM post_events pe
JOIN seed_posts sp ON sp.id = pe.post_id
ORDER BY pe.created_at DESC
LIMIT 200;

\echo '=== 4) ULTIMA METRICA POR POST DO LOTE ==='
WITH seed_posts AS (
  SELECT p.id, p.caption
  FROM posts p
  WHERE p.caption LIKE 'Lote teste %'
  ORDER BY p.created_at DESC
  LIMIT 20
),
last_metric AS (
  SELECT DISTINCT ON (pm.post_id)
    pm.post_id,
    pm.views,
    pm.likes,
    pm.comments,
    pm.shares,
    pm.saved,
    pm.reach,
    pm.engagement_rate,
    pm.fetched_at
  FROM post_metrics pm
  JOIN seed_posts sp ON sp.id = pm.post_id
  ORDER BY pm.post_id, pm.fetched_at DESC
)
SELECT
  sp.id AS post_id,
  sp.caption,
  lm.views,
  lm.likes,
  lm.comments,
  lm.shares,
  lm.saved,
  lm.reach,
  lm.engagement_rate,
  lm.fetched_at
FROM seed_posts sp
LEFT JOIN last_metric lm ON lm.post_id = sp.id
ORDER BY sp.caption;

\echo '=== 5) LINHA DO TEMPO (POST + EVENTOS) ==='
WITH seed_posts AS (
  SELECT p.id, p.caption, p.created_at
  FROM posts p
  WHERE p.caption LIKE 'Lote teste %'
  ORDER BY p.created_at DESC
  LIMIT 20
)
SELECT
  sp.id AS post_id,
  sp.caption,
  'post_created'::text AS kind,
  NULL::text AS event_type,
  NULL::jsonb AS details,
  sp.created_at AS at
FROM seed_posts sp
UNION ALL
SELECT
  pe.post_id,
  sp.caption,
  'event'::text AS kind,
  pe.event_type,
  pe.details,
  pe.created_at AS at
FROM post_events pe
JOIN seed_posts sp ON sp.id = pe.post_id
ORDER BY at DESC;
