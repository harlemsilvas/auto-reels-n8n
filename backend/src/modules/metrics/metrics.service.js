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
  const result = await query(
    `
      SELECT views, likes, comments, shares, saved, reach
      FROM post_metrics
      WHERE post_id = $1::uuid
      ORDER BY fetched_at DESC, id DESC
      LIMIT 1
    `,
    [postId],
  );

  if (result.rowCount === 0) {
    return {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saved: 0,
      reach: 0,
    };
  }

  return result.rows[0];
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

async function insertMetrics(postId, snapshot) {
  await query(
    `
      INSERT INTO post_metrics (
        post_id,
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
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        NOW()
      )
    `,
    [
      postId,
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

async function appendCollectionEvent(postId, details) {
  await query(
    `
      INSERT INTO post_events (post_id, event_type, details)
      VALUES ($1::uuid, 'metrics_collected', $2::jsonb)
    `,
    [postId, JSON.stringify(details)],
  );
}

async function collectInsightsBatch(filters = {}) {
  if (POSTS_DATA_SOURCE !== "db") {
    return {
      source: POSTS_DATA_SOURCE,
      collected: 0,
      skipped: 0,
      totalCandidates: 0,
      mode: "file-noop",
    };
  }

  const posts = await listPublishedPostsForCollection(filters);
  let collected = 0;
  let skipped = 0;
  let metaCollected = 0;
  let fallbackCollected = 0;

  for (const post of posts) {
    try {
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
      await insertMetrics(post.id, snapshot);

      await appendCollectionEvent(post.id, {
        source: "metrics.collector",
        sourceMode,
        sourceError,
        accountId: post.accountId,
        metaMediaId: post.metaMediaId,
      });

      if (sourceMode === "meta-api") {
        metaCollected += 1;
      } else {
        fallbackCollected += 1;
      }

      collected += 1;
    } catch (_error) {
      skipped += 1;
    }
  }

  return {
    source: POSTS_DATA_SOURCE,
    collected,
    skipped,
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
    };
  }

  const values = [];
  const where = ["1 = 1"];
  let param = 1;

  if (filters.postId) {
    where.push(`pm.post_id = $${param++}::uuid`);
    values.push(filters.postId);
  }

  if (filters.accountId) {
    where.push(`p.account_id = $${param++}::uuid`);
    values.push(filters.accountId);
  }

  const limit = toPositiveInt(filters.limit, 100);
  values.push(limit);

  const result = await query(
    `
      SELECT
        pm.id,
        pm.post_id::text AS "postId",
        p.account_id::text AS "accountId",
        p.meta_media_id AS "metaMediaId",
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
    `,
    values,
  );

  return {
    source: POSTS_DATA_SOURCE,
    items: result.rows,
    total: result.rows.length,
  };
}

module.exports = {
  getOperationalOverview,
  collectInsightsBatch,
  getMetricsHistory,
};
