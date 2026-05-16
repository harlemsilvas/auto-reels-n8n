-- Verifica prontidao de posts publicados para coleta real da Meta Insights API
-- Critério de prontidao:
-- 1) posts.status = 'published'
-- 2) posts.meta_media_id preenchido
-- 3) instagram_accounts.access_token preenchido

WITH base AS (
  SELECT
    p.id,
    p.account_id,
    p.status,
    p.published_at,
    p.meta_media_id,
    ia.nome AS account_name,
    ia.instagram_id,
    ia.token_expires_at,
    ia.access_token,
    (NULLIF(TRIM(COALESCE(p.meta_media_id, '')), '') IS NOT NULL) AS has_meta_media_id,
    (NULLIF(TRIM(COALESCE(ia.access_token, '')), '') IS NOT NULL) AS has_access_token
  FROM posts p
  INNER JOIN instagram_accounts ia ON ia.id = p.account_id
  WHERE p.deleted_at IS NULL
    AND p.status = 'published'
), readiness AS (
  SELECT
    *,
    (has_meta_media_id AND has_access_token) AS ready_for_meta_insights,
    CASE
      WHEN has_meta_media_id AND has_access_token THEN 'ready'
      WHEN NOT has_meta_media_id AND NOT has_access_token THEN 'missing_meta_media_id_and_token'
      WHEN NOT has_meta_media_id THEN 'missing_meta_media_id'
      WHEN NOT has_access_token THEN 'missing_access_token'
      ELSE 'unknown'
    END AS readiness_reason
  FROM base
)
SELECT
  COUNT(*) AS published_total,
  COUNT(*) FILTER (WHERE ready_for_meta_insights) AS ready_total,
  COUNT(*) FILTER (WHERE NOT ready_for_meta_insights) AS fallback_total,
  COUNT(*) FILTER (WHERE readiness_reason = 'missing_meta_media_id') AS missing_meta_media_id_total,
  COUNT(*) FILTER (WHERE readiness_reason = 'missing_access_token') AS missing_access_token_total,
  COUNT(*) FILTER (WHERE readiness_reason = 'missing_meta_media_id_and_token') AS missing_both_total
FROM readiness;

-- Distribuicao por motivo
WITH base AS (
  SELECT
    p.id,
    p.account_id,
    p.status,
    p.meta_media_id,
    ia.access_token,
    (NULLIF(TRIM(COALESCE(p.meta_media_id, '')), '') IS NOT NULL) AS has_meta_media_id,
    (NULLIF(TRIM(COALESCE(ia.access_token, '')), '') IS NOT NULL) AS has_access_token
  FROM posts p
  INNER JOIN instagram_accounts ia ON ia.id = p.account_id
  WHERE p.deleted_at IS NULL
    AND p.status = 'published'
), readiness AS (
  SELECT
    CASE
      WHEN has_meta_media_id AND has_access_token THEN 'ready'
      WHEN NOT has_meta_media_id AND NOT has_access_token THEN 'missing_meta_media_id_and_token'
      WHEN NOT has_meta_media_id THEN 'missing_meta_media_id'
      WHEN NOT has_access_token THEN 'missing_access_token'
      ELSE 'unknown'
    END AS readiness_reason
  FROM base
)
SELECT readiness_reason, COUNT(*) AS total
FROM readiness
GROUP BY readiness_reason
ORDER BY total DESC;

-- Lista dos posts publicados que NAO estao prontos para coleta real
WITH base AS (
  SELECT
    p.id,
    p.account_id,
    p.published_at,
    p.meta_media_id,
    ia.nome AS account_name,
    ia.instagram_id,
    ia.token_expires_at,
    ia.access_token,
    (NULLIF(TRIM(COALESCE(p.meta_media_id, '')), '') IS NOT NULL) AS has_meta_media_id,
    (NULLIF(TRIM(COALESCE(ia.access_token, '')), '') IS NOT NULL) AS has_access_token
  FROM posts p
  INNER JOIN instagram_accounts ia ON ia.id = p.account_id
  WHERE p.deleted_at IS NULL
    AND p.status = 'published'
), readiness AS (
  SELECT
    id,
    account_id,
    account_name,
    instagram_id,
    published_at,
    meta_media_id,
    token_expires_at,
    has_meta_media_id,
    has_access_token,
    CASE
      WHEN NOT has_meta_media_id AND NOT has_access_token THEN 'missing_meta_media_id_and_token'
      WHEN NOT has_meta_media_id THEN 'missing_meta_media_id'
      WHEN NOT has_access_token THEN 'missing_access_token'
      ELSE 'ready'
    END AS readiness_reason
  FROM base
)
SELECT
  id,
  account_id,
  account_name,
  instagram_id,
  published_at,
  meta_media_id,
  token_expires_at,
  has_meta_media_id,
  has_access_token,
  readiness_reason
FROM readiness
WHERE readiness_reason <> 'ready'
ORDER BY published_at DESC NULLS LAST
LIMIT 200;

-- Amostra dos posts prontos
WITH base AS (
  SELECT
    p.id,
    p.account_id,
    p.published_at,
    p.meta_media_id,
    ia.nome AS account_name,
    ia.instagram_id,
    (NULLIF(TRIM(COALESCE(p.meta_media_id, '')), '') IS NOT NULL) AS has_meta_media_id,
    (NULLIF(TRIM(COALESCE(ia.access_token, '')), '') IS NOT NULL) AS has_access_token
  FROM posts p
  INNER JOIN instagram_accounts ia ON ia.id = p.account_id
  WHERE p.deleted_at IS NULL
    AND p.status = 'published'
)
SELECT
  id,
  account_id,
  account_name,
  instagram_id,
  published_at,
  meta_media_id
FROM base
WHERE has_meta_media_id AND has_access_token
ORDER BY published_at DESC NULLS LAST
LIMIT 50;
