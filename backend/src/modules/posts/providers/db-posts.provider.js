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
  console.log("======================================");
  console.log("[CREATE POST FROM UPLOAD]");
  console.log("INPUT:", {
    originalFileName: input.originalFileName,
    storedFileName: input.storedFileName,
    storagePath: input.storagePath,
    fileSize: input.fileSize,
    scheduleAt: input.scheduleAt,
  });

  const account = await findDefaultActiveAccount();

  console.log("[ACTIVE ACCOUNT]", account);

  if (!account) {
    const error = new Error(
      "Nenhuma conta ativa cadastrada para vincular o post.",
    );

    error.status = 400;

    throw error;
  }

  let scheduleAt = null;
  let hasFutureSchedule = false;

  if (input.scheduleAt) {
    const parsedDate = new Date(input.scheduleAt);

    if (!Number.isNaN(parsedDate.getTime())) {
      scheduleAt = parsedDate;
      hasFutureSchedule = parsedDate.getTime() > Date.now();
    }
  }

  const initialStatus = hasFutureSchedule ? "scheduled" : "pending";

  console.log("[SCHEDULE]", {
    scheduleAt,
    hasFutureSchedule,
    initialStatus,
  });

  const uploadResult = await query(
    `
      INSERT INTO uploads (
        workspace_id,
        original_filename,
        stored_filename,
        mime_type,
        file_size,
        storage_path,
        storage_status,
        created_at,
        updated_at
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, 'local', NOW(), NOW())
      RETURNING id::text AS id
    `,
    [
      input.workspaceId,
      input.originalFileName,
      input.storedFileName,
      "video/mp4",
      input.fileSize ?? null,
      input.storagePath,
    ],
  );

  console.log("[UPLOAD CREATED]", uploadResult.rows[0]);

  const uploadId = uploadResult.rows[0].id;

  const postResult = await query(
    `
      INSERT INTO posts (
        workspace_id,
        account_id,
        upload_id,
        caption,
        source_path,
        scheduled_at,
        status,
        created_at,
        updated_at
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4,
        $5,
        $6::timestamptz,
        $7,
        NOW(),
        NOW()
      )
      RETURNING
        id::text AS id,
        status::text AS status,
        scheduled_at AS "scheduledAt"
    `,
    [
      account.workspaceId,
      account.id,
      uploadId,
      input.captionText ?? null,
      input.storagePath,
      hasFutureSchedule ? scheduleAt.toISOString() : null,
      initialStatus,
    ],
  );

  console.log("[POST CREATED]", postResult.rows[0]);

  console.log("======================================");

  return {
    found: true,
    payload: postResult.rows[0],
  };
}

async function listReadyPosts() {
  console.log("======================================");
  console.log("[DB READY POSTS]");
  console.log("Buscando posts prontos para fila...");

  const sql = `
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

      ia.instagram_id AS "igAccountId",

      COALESCE(
        ia.access_token,
        $1
      ) AS "metaToken",

      u.id::text AS "uploadId",
      u.stored_filename AS "videoFile",
      u.storage_path AS "storagePath"

    FROM posts p

    LEFT JOIN uploads u
      ON u.id = p.upload_id

    LEFT JOIN instagram_accounts ia
      ON ia.id = p.account_id

    WHERE p.deleted_at IS NULL

      AND (
        p.status = 'pending'

        OR (
          p.status = 'scheduled'
          AND p.scheduled_at <= NOW()
        )
        OR (
          p.status = 'retrying'
          AND (
            p.next_retry_at IS NULL
            OR p.next_retry_at <= NOW()
          )
        )
      )

    ORDER BY
      COALESCE(p.scheduled_at, p.created_at) ASC

    LIMIT 50
  `;

  console.log("[READY SQL]");
  if (process.env.NODE_ENV !== "production") {
    console.log(sql);
  }

  const result = await query(sql, [META_FALLBACK_TOKEN ?? null]);

  console.log("[DB READY POSTS] TOTAL:", result.rows.length);

  if (result.rows.length === 0) {
    console.log("[DB READY POSTS] Nenhum post pronto encontrado");
  }

  const items = result.rows.map((row) => ({
    ...row,
    captionText: row.caption,
    metaGraphVersion: META_GRAPH_API_VERSION,
    mediaPublicUrl: row.videoFile
      ? `${MEDIA_PUBLIC_BASE_URL}/pending/${row.videoFile}`
      : null,
  }));

  items.forEach((row) => {
    console.log("[READY ITEM]", {
      id: row.id,
      status: row.status,
      scheduledAt: row.scheduledAt,
      videoFile: row.videoFile,
      igAccountId: row.igAccountId,
    });
  });

  console.log("======================================");

  return {
    total: items.length,
    items,
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
        ia.instagram_id AS "igAccountId",
        ia.access_token AS "metaToken",
        u.stored_filename AS "videoFile"
        FROM posts p
        LEFT JOIN uploads u
          ON u.id = p.upload_id
        LEFT JOIN instagram_accounts ia
          ON ia.id = p.account_id
      WHERE ${where.join(" AND ")}
      ORDER BY
        CASE WHEN p.scheduled_at IS NULL THEN 1 ELSE 0 END,
        p.scheduled_at ASC,
        p.created_at ASC,
        p.updated_at DESC
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

  if (Object.prototype.hasOwnProperty.call(extra, "scheduled_at")) {
    fields.push(`scheduled_at = $${nextIndex++}`);
    values.push(extra.scheduled_at);
  }

  if (Object.prototype.hasOwnProperty.call(extra, "next_retry_at")) {
    fields.push(`next_retry_at = $${nextIndex++}`);
    values.push(extra.next_retry_at);
  }

  if (Object.prototype.hasOwnProperty.call(extra, "retry_count")) {
    fields.push(`retry_count = $${nextIndex++}`);
    values.push(extra.retry_count);
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

async function markPostError(id, errorMessage, currentRetryCount = 0) {
  const now = new Date();
  const nextRetryCount = currentRetryCount + 1;

  const shouldFailPermanently = nextRetryCount >= 5;

  return updateStatus(id, shouldFailPermanently ? "error" : "retrying", {
    processing_finished_at: now,
    error_message: errorMessage,
    last_retry_at: now,
    next_retry_at: new Date(now.getTime() + 60_000),
    retry_count: nextRetryCount,
  });
}

async function cancelPostSchedule(id) {
  return updateStatus(id, "canceled", {
    scheduled_at: null,
    error_message: "Cancelado pelo usuario.",
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
  cancelPostSchedule,
  addPostEvent,
};
