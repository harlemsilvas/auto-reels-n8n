const {
  POSTS_DATA_SOURCE,
  INSIGHTS_BATCH_SIZE,
  META_GRAPH_API_VERSION,
  META_FALLBACK_TOKEN,
} = require("../../config/env");
const { query } = require("../../lib/db");
const {
  listPendingMedia,
  getFileOperationalCounts,
} = require("../../services/media.service");
const { getQueueStats } = require("../scheduler/scheduler.queue");

function emptyPostCounters() {
  return {
    pending: 0,
    scheduled: 0,
    queued: 0,
    processing: 0,
    retrying: 0,
    published: 0,
    error: 0,
    canceled: 0,
    total: 0,
  };
}

async function getDbPostCounters() {
  const counters = emptyPostCounters();

  const result = await query(
    `
      SELECT status::text AS status, COUNT(*)::int AS total
      FROM posts
      WHERE deleted_at IS NULL
      GROUP BY status
    `,
  );

  for (const row of result.rows) {
    if (Object.prototype.hasOwnProperty.call(counters, row.status)) {
      counters[row.status] = Number(row.total);
    }
  }

  counters.total =
    counters.pending +
    counters.scheduled +
    counters.queued +
    counters.processing +
    counters.retrying +
    counters.published +
    counters.error +
    counters.canceled;

  return counters;
}

async function getFilePostCounters() {
  const counters = emptyPostCounters();
  const [pending, dirs] = await Promise.all([
    listPendingMedia(),
    getFileOperationalCounts(),
  ]);

  counters.pending = pending.items.length;
  counters.published = dirs.published;
  counters.error = dirs.error;
  counters.total = counters.pending + counters.published + counters.error;

  return counters;
}

async function getOperationalOverview() {
  const [posts, queue] = await Promise.all([
    POSTS_DATA_SOURCE === "db" ? getDbPostCounters() : getFilePostCounters(),
    getQueueStats().catch(() => ({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    })),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    source: POSTS_DATA_SOURCE,
    posts,
    queue,
  };
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }

  return Math.trunc(n);
}

function toNonNegativeInt(value, fallback = 0) {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }

  return Math.trunc(n);
}

async function listPublishedPostsForCollection(filters = {}) {
  const values = [];
  const where = ["p.deleted_at IS NULL", "p.status = 'published'"];
  let param = 1;

  if (filters.postId) {
    where.push(`p.id = $${param++}::uuid`);
    values.push(filters.postId);
  }

  if (filters.accountId) {
    where.push(`p.account_id = $${param++}::uuid`);
    values.push(filters.accountId);
  }

  const limit = toPositiveInt(filters.limit, INSIGHTS_BATCH_SIZE);
  values.push(limit);

  const result = await query(
    `
      SELECT
        p.id::text AS id,
        p.workspace_id::text AS "workspaceId",
        p.account_id::text AS "accountId",
        p.meta_media_id AS "metaMediaId",
        ia.access_token AS "accessToken"
      FROM posts p
      INNER JOIN instagram_accounts ia ON ia.id = p.account_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
      LIMIT $${param}
    `,
    values,
  );

  return result.rows;
}

async function getLatestMetricsByPostId(postId) {
  const row = await getLatestMetricsRowByPostId(postId);

  if (!row) {
    return {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saved: 0,
      reach: 0,
    };
  }

  return row;
}

async function getLatestMetricsRowByPostId(postId) {
  const result = await query(
    `
      SELECT
        views,
        likes,
        comments,
        shares,
        saved,
        reach,
        engagement_rate AS "engagementRate",
        fetched_at AS "fetchedAt"
      FROM post_metrics
      WHERE post_id = $1::uuid
      ORDER BY fetched_at DESC, id DESC
      LIMIT 1
    `,
    [postId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

function metricsAreEqual(previous, current) {
  if (!previous) {
    return false;
  }

  return (
    Number(previous.views ?? 0) === current.views &&
    Number(previous.likes ?? 0) === current.likes &&
    Number(previous.comments ?? 0) === current.comments &&
    Number(previous.shares ?? 0) === current.shares &&
    Number(previous.saved ?? 0) === current.saved &&
    Number(previous.reach ?? 0) === current.reach
  );
}

function buildMetricsSnapshot(baseMetrics) {
  const views = Number(baseMetrics.views ?? 0);
  const likes = Number(baseMetrics.likes ?? 0);
  const comments = Number(baseMetrics.comments ?? 0);
  const shares = Number(baseMetrics.shares ?? 0);
  const saved = Number(baseMetrics.saved ?? 0);
  const reach = Number(baseMetrics.reach ?? 0);

  const engagementRaw = likes + comments + shares + saved;
  const engagementRate = reach > 0 ? (engagementRaw / reach) * 100 : 0;

  return {
    views,
    likes,
    comments,
    shares,
    saved,
    reach,
    engagementRate: Number(engagementRate.toFixed(2)),
  };
}

function toNumberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildGraphUrl(pathname, params) {
  const url = new URL(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${pathname}`,
  );

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function fetchJsonWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const bodyText = await response.text();

    if (!response.ok) {
      throw new Error(`Meta API ${response.status}: ${bodyText.slice(0, 300)}`);
    }

    return bodyText ? JSON.parse(bodyText) : {};
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeInsightValue(value) {
  if (typeof value === "number") {
    return value;
  }

  if (value && typeof value === "object") {
    if (typeof value.value === "number") {
      return value.value;
    }

    const firstNumeric = Object.values(value).find((item) =>
      Number.isFinite(Number(item)),
    );

    return firstNumeric !== undefined ? Number(firstNumeric) : 0;
  }

  return toNumberOrZero(value);
}

async function fetchMediaBaseCounters(metaMediaId, token) {
  const fields = "like_count,comments_count";
  const url = buildGraphUrl(metaMediaId, {
    fields,
    access_token: token,
  });

  const json = await fetchJsonWithTimeout(url);

  return {
    likes: toNumberOrZero(json.like_count),
    comments: toNumberOrZero(json.comments_count),
  };
}

async function fetchMediaInsights(metaMediaId, token) {
  const metricSets = [
    "reach,saved,shares,views",
    "reach,saved,shares,video_views",
    "reach,saved,shares,plays",
    "impressions,reach,saved,shares,video_views",
    "reach,saved",
  ];

  for (const metricSet of metricSets) {
    try {
      const url = buildGraphUrl(`${metaMediaId}/insights`, {
        metric: metricSet,
        access_token: token,
      });

      const json = await fetchJsonWithTimeout(url);
      const data = Array.isArray(json.data) ? json.data : [];

      const metricsMap = {};
      data.forEach((entry) => {
        const name = entry?.name;
        const raw = Array.isArray(entry?.values)
          ? entry.values[0]?.value
          : entry?.value;

        if (name) {
          metricsMap[name] = normalizeInsightValue(raw);
        }
      });
      console.log("[META INSIGHTS RAW]", {
        metaMediaId,
        metricSet,
        json: JSON.stringify(json, null, 2),
      });
      return metricsMap;
    } catch (_error) {
      // Tenta proximo conjunto de metricas.
    }
  }

  return {};
}

async function fetchMetaMetricsForPost(post) {
  const token = post.accessToken || META_FALLBACK_TOKEN;

  if (!post.metaMediaId) {
    throw new Error("meta_media_id ausente para coleta externa");
  }

  if (!token) {
    throw new Error("access_token ausente para coleta externa");
  }

  const [baseCounters, insightCounters] = await Promise.all([
    fetchMediaBaseCounters(post.metaMediaId, token),
    fetchMediaInsights(post.metaMediaId, token),
  ]);

  const views =
    toNumberOrZero(insightCounters.views) ||
    toNumberOrZero(insightCounters.video_views) ||
    toNumberOrZero(insightCounters.plays) ||
    toNumberOrZero(insightCounters.impressions);

  return {
    views,
    likes: baseCounters.likes,
    comments: baseCounters.comments,
    shares: toNumberOrZero(insightCounters.shares),
    saved: toNumberOrZero(insightCounters.saved),
    reach:
      toNumberOrZero(insightCounters.reach) ||
      toNumberOrZero(insightCounters.impressions),
    sourceMode: "meta-api",
  };
}

async function insertMetrics(postId, workspaceId, snapshot) {
  await query(
    `
      INSERT INTO post_metrics (
        post_id,
        workspace_id,
        views,
        likes,
        comments,
        shares,
        saved,
        reach,
        engagement_rate,
        fetched_at
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        NOW()
      )
    `,
    [
      postId,
      workspaceId,
      snapshot.views,
      snapshot.likes,
      snapshot.comments,
      snapshot.shares,
      snapshot.saved,
      snapshot.reach,
      snapshot.engagementRate,
    ],
  );
}

async function appendCollectionEvent(
  workspaceId,
  postId,
  details,
  eventType = "metrics_collected",
) {
  await query(
    `
      INSERT INTO post_events (
        workspace_id,
        post_id,
        event_type,
        details
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3,
        $4::jsonb
      )
    `,
    [workspaceId, postId, eventType, JSON.stringify(details)],
  );
}

async function collectMetricsForPost(post) {
  let sourceMode = "fallback-snapshot";
  let sourceError = null;
  let metricsInput;

  try {
    metricsInput = await fetchMetaMetricsForPost(post);
    sourceMode = "meta-api";
  } catch (error) {
    sourceError = error.message;
    metricsInput = await getLatestMetricsByPostId(post.id);
  }

  const snapshot = buildMetricsSnapshot(metricsInput);
  if (!post.workspaceId) {
    throw new Error(`workspaceId ausente para post ${post.id}`);
  }

  const previousSnapshot = await getLatestMetricsRowByPostId(post.id);
  const eventDetails = {
    source: "metrics.collector",
    sourceMode,
    sourceError,
    accountId: post.accountId,
    metaMediaId: post.metaMediaId,
  };

  if (metricsAreEqual(previousSnapshot, snapshot)) {
    await appendCollectionEvent(
      post.workspaceId,
      post.id,
      {
        ...eventDetails,
        reason: "unchanged",
      },
      "metrics_unchanged",
    );

    return {
      collected: false,
      reason: "unchanged",
      sourceMode,
    };
  }

  await insertMetrics(post.id, post.workspaceId, snapshot);

  await appendCollectionEvent(
    post.workspaceId,
    post.id,
    eventDetails,
    "metrics_collected",
  );

  return {
    collected: true,
    sourceMode,
  };
}

async function getPostMetricsTimeline(postId, filters = {}) {
  const values = [postId];
  const where = ["pm.post_id = $1::uuid"];
  let param = 2;

  if (filters.days) {
    where.push(
      `pm.fetched_at >= NOW() - ($${param++}::int * INTERVAL '1 day')`,
    );
    values.push(toPositiveInt(filters.days, 30));
  }

  const result = await query(
    `
      SELECT
        pm.fetched_at AS date,
        pm.likes,
        pm.views,
        pm.reach
      FROM post_metrics pm
      WHERE ${where.join(" AND ")}
      ORDER BY pm.fetched_at ASC, pm.id ASC
    `,
    values,
  );

  return result.rows.map((row) => ({
    date: row.date,
    likes: Number(row.likes ?? 0),
    views: Number(row.views ?? 0),
    reach: Number(row.reach ?? 0),
  }));
}

async function getPostDetail(postId) {
  const [postResult, metricsResult, eventsResult, timeline] = await Promise.all(
    [
      query(
        `
          SELECT
            p.id::text AS id,
            p.title,
            p.video_filename AS "videoFilename",
            COALESCE(p.video_filename, primary_media.stored_filename) AS "mediaFile",
            p.caption,
            p.publish_type AS "publishType",
            p.media_type AS "mediaType",
            p.scheduled_at AS "scheduledAt",
            p.created_at AS "createdAt",
            p.updated_at AS "updatedAt",
            p.published_at AS "publishedAt",
            p.retry_count AS "retryCount",
            p.error_message AS "errorMessage",
            p.meta_container_id AS "metaContainerId",
            p.meta_media_id AS "metaMediaId",
            p.status::text AS status,
            p.media_template_id::text AS "mediaTemplateId",
            p.media_template_text_variant_id::text AS "mediaTemplateTextVariantId",
            mt.tag AS "mediaTemplateTag",
            mt.name AS "mediaTemplateName",
            mttv.title AS "mediaTemplateTextVariantTitle",
            media_summary.item_count::int AS "mediaItemsCount",
            ia.nome AS "accountName",
            ia.instagram_id AS "instagramId"
          FROM posts p
          LEFT JOIN instagram_accounts ia
            ON ia.id = p.account_id
          LEFT JOIN media_templates mt
            ON mt.id = p.media_template_id
          LEFT JOIN media_template_text_variants mttv
            ON mttv.id = p.media_template_text_variant_id
          LEFT JOIN LATERAL (
            SELECT pmi.stored_filename
            FROM post_media_items pmi
            WHERE pmi.post_id = p.id
              AND pmi.deleted_at IS NULL
            ORDER BY pmi.sort_order ASC
            LIMIT 1
          ) primary_media ON TRUE
          LEFT JOIN LATERAL (
            SELECT COUNT(*) AS item_count
            FROM post_media_items pmi
            WHERE pmi.post_id = p.id
              AND pmi.deleted_at IS NULL
          ) media_summary ON TRUE
          WHERE p.deleted_at IS NULL
            AND p.id = $1::uuid
          LIMIT 1
        `,
        [postId],
      ),
      query(
        `
          SELECT
            pm.views,
            pm.likes,
            pm.comments,
            pm.shares,
            pm.saved,
            pm.reach,
            pm.engagement_rate AS "engagementRate",
            pm.fetched_at AS "fetchedAt"
          FROM post_metrics pm
          WHERE pm.post_id = $1::uuid
          ORDER BY pm.fetched_at DESC, pm.id DESC
          LIMIT 2
        `,
        [postId],
      ),
      query(
        `
          SELECT
            pe.id,
            pe.event_type AS "eventType",
            pe.details,
            pe.created_at AS "createdAt"
          FROM post_events pe
          WHERE pe.post_id = $1::uuid
          ORDER BY pe.created_at DESC, pe.id DESC
          LIMIT 50
        `,
        [postId],
      ),
      getPostMetricsTimeline(postId),
    ],
  );

  if (postResult.rowCount === 0) {
    const error = new Error("Post nao encontrado.");
    error.status = 404;
    throw error;
  }

  const latest = metricsResult.rows[0] ?? null;
  const previous = metricsResult.rows[1] ?? null;
  const delta = latest
    ? {
        likes: Number(latest.likes ?? 0) - Number(previous?.likes ?? 0),
        views: Number(latest.views ?? 0) - Number(previous?.views ?? 0),
        reach: Number(latest.reach ?? 0) - Number(previous?.reach ?? 0),
      }
    : { likes: 0, views: 0, reach: 0 };

  return {
    post: postResult.rows[0],
    latestMetrics: latest,
    delta,
    timeline,
    events: eventsResult.rows,
  };
}

async function collectInsightsBatch(filters = {}) {
  if (POSTS_DATA_SOURCE !== "db") {
    return {
      source: POSTS_DATA_SOURCE,
      collected: 0,
      skipped: 0,
      unchanged: 0,
      totalCandidates: 0,
      mode: "file-noop",
    };
  }

  const posts = await listPublishedPostsForCollection(filters);
  let collected = 0;
  let skipped = 0;
  let unchanged = 0;
  let metaCollected = 0;
  let fallbackCollected = 0;

  for (const post of posts) {
    try {
      const result = await collectMetricsForPost(post);

      if (result.sourceMode === "meta-api") {
        metaCollected += 1;
      } else {
        fallbackCollected += 1;
      }

      if (result.collected) {
        collected += 1;
      } else if (result.reason === "unchanged") {
        unchanged += 1;
      }
    } catch (_error) {
      skipped += 1;
    }
  }

  return {
    source: POSTS_DATA_SOURCE,
    collected,
    skipped,
    unchanged,
    metaCollected,
    fallbackCollected,
    totalCandidates: posts.length,
    mode: "db-meta-with-fallback",
  };
}

async function getMetricsHistory(filters = {}) {
  if (POSTS_DATA_SOURCE !== "db") {
    return {
      source: POSTS_DATA_SOURCE,
      items: [],
      total: 0,
      limit: toPositiveInt(filters.limit, 100),
      offset: toNonNegativeInt(filters.offset, 0),
    };
  }

  const values = [];
  const where = ["1 = 1"];
  let param = 1;
  const groupByPost = filters.groupByPost === true;

  if (filters.postId) {
    where.push(`pm.post_id = $${param++}::uuid`);
    values.push(filters.postId);
  }

  if (filters.accountId) {
    where.push(`p.account_id = $${param++}::uuid`);
    values.push(filters.accountId);
  }

  const limit = toPositiveInt(filters.limit, 100);
  const offset = toNonNegativeInt(filters.offset, 0);
  const countValues = [...values];
  const offsetParam = param + 1;
  values.push(limit, offset);

  const totalResult = await query(
    groupByPost
      ? `
          SELECT COUNT(DISTINCT pm.post_id)::int AS total
          FROM post_metrics pm
          INNER JOIN posts p ON p.id = pm.post_id
          WHERE ${where.join(" AND ")}
        `
      : `
          SELECT COUNT(*)::int AS total
          FROM post_metrics pm
          INNER JOIN posts p ON p.id = pm.post_id
          WHERE ${where.join(" AND ")}
        `,
    countValues,
  );

  const result = await query(
    groupByPost
      ? `
          SELECT *
          FROM (
            SELECT DISTINCT ON (pm.post_id)
              pm.id,
              pm.post_id::text AS "postId",
              p.account_id::text AS "accountId",
              p.meta_media_id AS "metaMediaId",
              p.video_filename AS "videoFilename",
              p.caption AS caption,
              pm.views,
              pm.likes,
              pm.comments,
              pm.shares,
              pm.saved,
              pm.reach,
              pm.engagement_rate AS "engagementRate",
              pm.fetched_at AS "fetchedAt"
            FROM post_metrics pm
            INNER JOIN posts p ON p.id = pm.post_id
            WHERE ${where.join(" AND ")}
            ORDER BY pm.post_id, pm.fetched_at DESC, pm.id DESC
          ) grouped_metrics
          ORDER BY "fetchedAt" DESC, id DESC
          LIMIT $${param}
          OFFSET $${offsetParam}
        `
      : `
          SELECT
            pm.id,
            pm.post_id::text AS "postId",
            p.account_id::text AS "accountId",
            p.meta_media_id AS "metaMediaId",
            p.video_filename AS "videoFilename",
            p.caption AS caption,
            pm.views,
            pm.likes,
            pm.comments,
            pm.shares,
            pm.saved,
            pm.reach,
            pm.engagement_rate AS "engagementRate",
            pm.fetched_at AS "fetchedAt"
          FROM post_metrics pm
          INNER JOIN posts p ON p.id = pm.post_id
          WHERE ${where.join(" AND ")}
          ORDER BY pm.fetched_at DESC, pm.id DESC
          LIMIT $${param}
          OFFSET $${offsetParam}
        `,
    values,
  );

  return {
    source: POSTS_DATA_SOURCE,
    items: result.rows,
    total: Number(totalResult.rows[0]?.total ?? 0),
    limit,
    offset,
  };
}

function normalizeTopPostsSort(sort) {
  if (sort === "reach" || sort === "views" || sort === "likes") {
    return sort;
  }

  return "likes";
}

async function getTopPosts(filters = {}) {
  if (POSTS_DATA_SOURCE !== "db") {
    return {
      source: POSTS_DATA_SOURCE,
      sort: normalizeTopPostsSort(filters.sort),
      items: [],
      total: 0,
    };
  }

  const sort = normalizeTopPostsSort(filters.sort);
  const limit = Math.min(toPositiveInt(filters.limit, 10), 50);

  const result = await query(
    `
      WITH latest_metrics AS (
        SELECT DISTINCT ON (pm.post_id)
          pm.post_id,
          pm.views,
          pm.likes,
          pm.reach,
          pm.engagement_rate,
          pm.fetched_at
        FROM post_metrics pm
        ORDER BY pm.post_id, pm.fetched_at DESC, pm.id DESC
      )
      SELECT
        p.id::text AS "postId",
        p.video_filename AS "videoFilename",
        p.caption,
        COALESCE(lm.likes, 0)::int AS likes,
        COALESCE(lm.reach, 0)::int AS reach,
        COALESCE(lm.views, 0)::int AS views,
        COALESCE(lm.engagement_rate, 0)::float AS "engagementRate",
        lm.fetched_at AS "fetchedAt"
      FROM posts p
      INNER JOIN latest_metrics lm
        ON lm.post_id = p.id
      WHERE p.deleted_at IS NULL
        AND p.status = 'published'
      ORDER BY
        CASE
          WHEN $1 = 'likes' THEN COALESCE(lm.likes, 0)
          WHEN $1 = 'reach' THEN COALESCE(lm.reach, 0)
          WHEN $1 = 'views' THEN COALESCE(lm.views, 0)
          ELSE COALESCE(lm.likes, 0)
        END DESC,
        lm.fetched_at DESC
      LIMIT $2
    `,
    [sort, limit],
  );

  return {
    source: POSTS_DATA_SOURCE,
    sort,
    items: result.rows,
    total: result.rows.length,
  };
}

module.exports = {
  getOperationalOverview,
  collectInsightsBatch,
  getMetricsHistory,
  getPostMetricsTimeline,
  getPostDetail,
  getTopPosts,
};
