const { query } = require("../../../lib/db");
const {
  META_GRAPH_API_VERSION,
  META_FALLBACK_TOKEN,
  MEDIA_PUBLIC_BASE_URL,
} = require("../../../config/env");

function toPositiveInt(value, fallback) {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }

  return Math.trunc(n);
}

async function findDefaultActiveAccount() {
  const result = await query(
    `
      SELECT
        id::text AS id,
        workspace_id::text AS "workspaceId"
      FROM instagram_accounts
      WHERE deleted_at IS NULL
        AND ativo = true
      ORDER BY created_at ASC
      LIMIT 1
    `,
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

async function createPostFromUpload(input) {
  const account = await findDefaultActiveAccount();

  if (!account) {
    const error = new Error(
      "Nenhuma conta ativa cadastrada para vincular o post.",
    );
    error.status = 400;
    throw error;
  }

  const uploadResult = await query(
    `
      INSERT INTO uploads (
        original_filename,
        stored_filename,
        mime_type,
        file_size,
        storage_path,
        storage_status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'local', NOW(), NOW())
      RETURNING id::text AS id
    `,
    [
      input.originalFileName,
      input.storedFileName,
      "video/mp4",
      input.fileSize ?? null,
      input.storagePath,
    ],
  );

  const uploadId = uploadResult.rows[0].id;

  const postResult = await query(
    `
      INSERT INTO posts (
        workspace_id,
        account_id,
        upload_id,
        caption,
        source_path,
        status,
        created_at,
        updated_at
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, 'pending', NOW(), NOW())
      RETURNING id::text AS id, status::text AS status
    `,
    [
      account.workspaceId,
      account.id,
      uploadId,
      input.captionText,
      input.storagePath,
    ],
  );

  return {
    found: true,
    payload: postResult.rows[0],
  };
}

async function listReadyPosts() {
  const result = await query(
    `
      SELECT
        p.id::text AS id,
        COALESCE(u.stored_filename, p.id::text || '.mp4') AS "videoFile",
        p.caption AS "captionText",
        p.created_at AS "createdAt",
        p.status::text AS status,
        ia.instagram_id AS "igAccountId",
        ia.access_token AS "accountToken"
      FROM posts p
      LEFT JOIN uploads u ON u.id = p.upload_id
      INNER JOIN instagram_accounts ia ON ia.id = p.account_id
      WHERE p.deleted_at IS NULL
        AND p.status IN ('pending', 'scheduled', 'queued', 'retrying')
        AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
      ORDER BY COALESCE(p.scheduled_at, p.created_at) ASC
      LIMIT 50
    `,
  );

  const items = result.rows.map((row) => ({
    id: row.id,
    videoFile: row.videoFile,
    captionText: row.captionText,
    createdAt: new Date(row.createdAt).toISOString(),
    status: row.status,
    igAccountId: row.igAccountId,
    metaToken: row.accountToken || META_FALLBACK_TOKEN || null,
    metaGraphVersion: META_GRAPH_API_VERSION,
    mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL || undefined,
  }));

  return {
    items,
    total: items.length,
  };
}

async function listPosts(filters = {}) {
  const values = [];
  const where = ["p.deleted_at IS NULL"];
  let param = 1;

  if (filters.status) {
    where.push(`p.status::text = $${param++}::text`);
    values.push(filters.status);
  }

  if (filters.postId) {
    where.push(`p.id = $${param++}::uuid`);
    values.push(filters.postId);
  }

  const limit = toPositiveInt(filters.limit, 50);
  values.push(limit);

  const result = await query(
    `
      SELECT
        p.id::text AS id,
        p.status::text AS status,
        p.caption,
        p.error_message AS "errorMessage",
        p.scheduled_at AS "scheduledAt",
        p.published_at AS "publishedAt",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        p.retry_count AS "retryCount",
        p.meta_media_id AS "metaMediaId",
        p.account_id::text AS "accountId",
        u.stored_filename AS "videoFile"
      FROM posts p
      LEFT JOIN uploads u ON u.id = p.upload_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.updated_at DESC, p.created_at DESC
      LIMIT $${param}
    `,
    values,
  );

  return {
    items: result.rows,
    total: result.rows.length,
  };
}

async function listPostEvents(filters = {}) {
  const values = [];
  const where = ["1 = 1"];
  let param = 1;

  if (filters.postId) {
    where.push(`pe.post_id = $${param++}::uuid`);
    values.push(filters.postId);
  }

  if (filters.eventType) {
    where.push(`pe.event_type = $${param++}`);
    values.push(filters.eventType);
  }

  const limit = toPositiveInt(filters.limit, 100);
  values.push(limit);

  const result = await query(
    `
      SELECT
        pe.id,
        pe.post_id::text AS "postId",
        pe.event_type AS "eventType",
        pe.details,
        pe.created_at AS "createdAt"
      FROM post_events pe
      WHERE ${where.join(" AND ")}
      ORDER BY pe.created_at DESC, pe.id DESC
      LIMIT $${param}
    `,
    values,
  );

  return {
    items: result.rows,
    total: result.rows.length,
  };
}

async function updateStatus(id, status, extra = {}) {
  const fields = ["status = $2", "updated_at = NOW()"];
  const values = [id, status];
  let nextIndex = 3;

  if (Object.prototype.hasOwnProperty.call(extra, "published_at")) {
    fields.push(`published_at = $${nextIndex++}`);
    values.push(extra.published_at);
  }

  if (Object.prototype.hasOwnProperty.call(extra, "processing_started_at")) {
    fields.push(`processing_started_at = $${nextIndex++}`);
    values.push(extra.processing_started_at);
  }

  if (Object.prototype.hasOwnProperty.call(extra, "processing_finished_at")) {
    fields.push(`processing_finished_at = $${nextIndex++}`);
    values.push(extra.processing_finished_at);
  }

  if (Object.prototype.hasOwnProperty.call(extra, "error_message")) {
    fields.push(`error_message = $${nextIndex++}`);
    values.push(extra.error_message);
  }

  if (Object.prototype.hasOwnProperty.call(extra, "last_retry_at")) {
    fields.push(`last_retry_at = $${nextIndex++}`);
    values.push(extra.last_retry_at);
  }

  if (Object.prototype.hasOwnProperty.call(extra, "meta_media_id")) {
    fields.push(`meta_media_id = $${nextIndex++}`);
    values.push(extra.meta_media_id);
  }

  if (Object.prototype.hasOwnProperty.call(extra, "meta_container_id")) {
    fields.push(`meta_container_id = $${nextIndex++}`);
    values.push(extra.meta_container_id);
  }

  const sql = `
    UPDATE posts
    SET ${fields.join(", ")}
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id::text AS id, status::text AS status
  `;

  const result = await query(sql, values);

  if (result.rowCount === 0) {
    return {
      found: false,
      payload: { message: "Post nao encontrado." },
    };
  }

  return {
    found: true,
    payload: {
      id: result.rows[0].id,
      status: result.rows[0].status,
    },
  };
}

async function markPostProcessing(id) {
  const now = new Date();

  return updateStatus(id, "processing", {
    processing_started_at: now,
    error_message: null,
  });
}

async function markPostQueued(id) {
  return updateStatus(id, "queued");
}

async function markPostPublished(id, payload = {}) {
  const now = new Date();

  return updateStatus(id, "published", {
    published_at: now,
    processing_finished_at: now,
    error_message: null,
    meta_media_id: payload.metaMediaId ?? null,
    meta_container_id: payload.metaContainerId ?? null,
  });
}

async function markPostError(id, errorMessage) {
  const now = new Date();

  return updateStatus(id, "error", {
    processing_finished_at: now,
    error_message: errorMessage,
    last_retry_at: now,
  });
}

async function addPostEvent(postId, eventType, details = {}) {
  await query(
    `
      INSERT INTO post_events (post_id, event_type, details)
      VALUES ($1::uuid, $2, $3::jsonb)
    `,
    [postId, eventType, JSON.stringify(details)],
  );

  return true;
}

module.exports = {
  createPostFromUpload,
  listReadyPosts,
  listPosts,
  listPostEvents,
  markPostProcessing,
  markPostQueued,
  markPostPublished,
  markPostError,
  addPostEvent,
};
