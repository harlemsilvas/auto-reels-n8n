// db-posts.provider.js
const { getPool, query } = require("../../../lib/db");
const {
  META_GRAPH_API_VERSION,
  META_FALLBACK_TOKEN,
  MEDIA_PUBLIC_BASE_URL,
  MULTI_PUBLISH_ENABLED,
} = require("../../../config/env");

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

async function findDefaultActiveAccount(workspaceId = null, executeQuery = query) {
  const values = [];
  const where = ["deleted_at IS NULL", "ativo = true"];

  if (workspaceId) {
    values.push(workspaceId);
    where.push(`workspace_id = $${values.length}::uuid`);
  }

  const result = await executeQuery(
    `
      SELECT
        id::text AS id,
        workspace_id::text AS "workspaceId"
      FROM instagram_accounts
      WHERE ${where.join(" AND ")}
      ORDER BY created_at ASC
      LIMIT 1
    `,
    values,
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

async function createPostFromUpload(input) {
  console.log("======================================");
  console.log("[CREATE POST FROM UPLOAD]");

  // const requestedWorkspaceId = String(input.workspaceId ?? "").trim() || null;
  // Remove espaços e garante que se vier a string "null" ou vazio, vire um null primitivo
  const rawWorkspace = String(input.workspaceId ?? "").trim();
  const requestedWorkspaceId =
    rawWorkspace === "" || rawWorkspace === "null" ? null : rawWorkspace;

  console.log("[INPUT]", {
    originalFileName: input.originalFileName,
    storedFileName: input.storedFileName,
    storagePath: input.storagePath,
    fileSize: input.fileSize,
    scheduleAt: input.scheduleAt,
    workspaceId: requestedWorkspaceId,
  });
  console.log("[POST INSERT VALUES]");
  console.log({
    storedFileName: input.storedFileName,
    fileSize: input.fileSize,
  });

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

  const mimeType = input.mimeType || "video/mp4";
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const executeQuery = client.query.bind(client);
    const account = await findDefaultActiveAccount(
      requestedWorkspaceId,
      executeQuery,
    );

    console.log("[ACTIVE ACCOUNT]", account);

    if (!account) {
      const error = new Error(
        "Nenhuma conta ativa cadastrada para vincular o post.",
      );

      error.status = 400;

      throw error;
    }

    const workspaceId = requestedWorkspaceId || account.workspaceId;

    console.log("[WORKSPACE]", {
      requestedWorkspaceId,
      resolvedWorkspaceId: workspaceId,
    });

    console.log("[INSERT UPLOAD START]");

    const uploadResult = await executeQuery(
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
        VALUES (
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          $6,
          'local',
          NOW(),
          NOW()
        )
        RETURNING id::text AS id
      `,
      [
        workspaceId,
        input.originalFileName,
        input.storedFileName,
        mimeType,
        input.fileSize ?? null,
        input.storagePath,
      ],
    );

    console.log("[UPLOAD CREATED]");
    console.log(uploadResult.rows[0]);

    const uploadId = uploadResult.rows[0].id;

    console.log("[INSERT POST START]");

    const postResult = await executeQuery(
      `
        INSERT INTO posts (
          workspace_id,
          account_id,
          upload_id,
          caption,
          source_path,
          video_filename,
          media_size,
          publish_type,
          media_type,
          scheduled_at,
          status,
          created_by_user_id,
          created_at,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5,
          $6,
          $7,
          'reel',
          'video',
          $8::timestamptz,
          $9,
          $10::uuid,
          NOW(),
          NOW()
        )
        RETURNING
          id::text AS id,
          status::text AS status,
          publish_type AS "publishType",
          scheduled_at AS "scheduledAt"
      `,
      [
        workspaceId,
        account.id,
        uploadId,
        input.captionText ?? null,
        input.storagePath,
        input.storedFileName ?? null,
        input.fileSize ?? null,
        hasFutureSchedule ? scheduleAt.toISOString() : null,
        initialStatus,
        input.createdByUserId ?? null,
      ],
    );

    const post = postResult.rows[0];

    await executeQuery(
      `
        INSERT INTO post_events (
          workspace_id,
          post_id,
          actor_user_id,
          event_type,
          details
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'created', $4::jsonb)
      `,
      [
        workspaceId,
        post.id,
        input.createdByUserId ?? null,
        JSON.stringify({ source: "media.upload", publishType: "reel" }),
      ],
    );

    console.log("[POST CREATED]");
    console.log(post);
    console.log("[INSERT POST MEDIA ITEM START]");

    await executeQuery(
      `
        INSERT INTO post_media_items (
          post_id,
          workspace_id,
          sort_order,
          media_kind,
          stored_filename,
          original_filename,
          storage_path,
          mime_type,
          file_size,
          is_carousel_item,
          created_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          0,
          'video',
          $3,
          $4,
          $5,
          $6,
          $7,
          FALSE,
          NOW()
        )
      `,
      [
        post.id,
        workspaceId,
        input.storedFileName,
        input.originalFileName,
        input.storagePath,
        mimeType,
        input.fileSize ?? null,
      ],
    );

    await client.query("COMMIT");

    console.log("[CREATE POST FROM UPLOAD COMMITTED]");
    console.log("======================================");

    return {
      found: true,
      payload: post,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[CREATE POST FROM UPLOAD ROLLBACK]", error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function createPostFromMediaUpload(input) {
  const rawWorkspace = String(input.workspaceId ?? "").trim();
  const requestedWorkspaceId =
    rawWorkspace === "" || rawWorkspace === "null" ? null : rawWorkspace;

  const scheduleAt = input.scheduleAt ? new Date(input.scheduleAt) : null;
  const hasFutureSchedule =
    scheduleAt && !Number.isNaN(scheduleAt.getTime())
      ? scheduleAt.getTime() > Date.now()
      : false;
  const initialStatus = hasFutureSchedule ? "scheduled" : "pending";
  const files = Array.isArray(input.files) ? input.files : [];
  const primaryFile = files[0];
  const mediaTypeByPublishType = {
    reel: "video",
    feed_image: "image",
    feed_carousel: "carousel",
    story_image: "image",
    story_video: "video",
  };

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const executeQuery = client.query.bind(client);
    const account = await findDefaultActiveAccount(
      requestedWorkspaceId,
      executeQuery,
    );

    if (!account) {
      const error = new Error(
        "Nenhuma conta ativa cadastrada para vincular o post.",
      );
      error.status = 400;
      throw error;
    }

    const workspaceId = requestedWorkspaceId || account.workspaceId;
    const uploads = [];

    for (const file of files) {
      const uploadResult = await executeQuery(
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
          VALUES (
            $1::uuid,
            $2,
            $3,
            $4,
            $5,
            $6,
            'local',
            NOW(),
            NOW()
          )
          RETURNING id::text AS id
        `,
        [
          workspaceId,
          file.originalFileName,
          file.storedFileName,
          file.mimeType,
          file.fileSize ?? null,
          file.storagePath,
        ],
      );

      uploads.push(uploadResult.rows[0]);
    }

    const isLegacyReel = input.publishType === "reel";
    const postResult = await executeQuery(
      `
        INSERT INTO posts (
          workspace_id,
          account_id,
          upload_id,
          caption,
          source_path,
          video_filename,
          media_size,
          publish_type,
          media_type,
          scheduled_at,
          status,
          created_by_user_id,
          created_at,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10::timestamptz,
          $11,
          $12::uuid,
          NOW(),
          NOW()
        )
        RETURNING
          id::text AS id,
          status::text AS status,
          publish_type AS "publishType",
          media_type AS "mediaType",
          scheduled_at AS "scheduledAt"
      `,
      [
        workspaceId,
        account.id,
        uploads[0].id,
        input.captionText || null,
        primaryFile.storagePath,
        isLegacyReel ? primaryFile.storedFileName : null,
        isLegacyReel ? (primaryFile.fileSize ?? null) : null,
        input.publishType,
        mediaTypeByPublishType[input.publishType],
        hasFutureSchedule ? scheduleAt.toISOString() : null,
        initialStatus,
        input.createdByUserId ?? null,
      ],
    );

    const post = postResult.rows[0];

    await executeQuery(
      `
        INSERT INTO post_events (
          workspace_id,
          post_id,
          actor_user_id,
          event_type,
          details
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'created', $4::jsonb)
      `,
      [
        workspaceId,
        post.id,
        input.createdByUserId ?? null,
        JSON.stringify({
          source: "media.upload-post",
          publishType: input.publishType,
          mediaItems: files.length,
        }),
      ],
    );

    for (const [index, file] of files.entries()) {
      await executeQuery(
        `
          INSERT INTO post_media_items (
            post_id,
            workspace_id,
            sort_order,
            media_kind,
            stored_filename,
            original_filename,
            storage_path,
            mime_type,
            file_size,
            is_carousel_item,
            created_at
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
            $10,
            NOW()
          )
        `,
        [
          post.id,
          workspaceId,
          index,
          file.mediaKind,
          file.storedFileName,
          file.originalFileName,
          file.storagePath,
          file.mimeType,
          file.fileSize ?? null,
          input.publishType === "feed_carousel",
        ],
      );
    }

    await client.query("COMMIT");

    return {
      found: true,
      payload: {
        ...post,
        mediaItems: files.length,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
      p.workspace_id::text AS "workspaceId",
      COALESCE(p.publish_type, 'reel') AS "publishType",
      p.video_filename AS "videoFile"

    FROM posts p

    WHERE p.deleted_at IS NULL
    AND (
      COALESCE(p.publish_type, 'reel') = 'reel'
      OR $1::boolean = TRUE
    )
    AND (
      (
        COALESCE(p.publish_type, 'reel') = 'reel'
        AND COALESCE(p.video_filename, '') <> ''
      )
      OR (
        COALESCE(p.publish_type, 'reel') <> 'reel'
        AND EXISTS (
          SELECT 1
          FROM post_media_items pmi
          WHERE pmi.post_id = p.id
            AND pmi.deleted_at IS NULL
        )
      )
    )

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

  const result = await query(sql, [MULTI_PUBLISH_ENABLED]);

  console.log("[DB READY POSTS] TOTAL:", result.rows.length);

  if (result.rows.length === 0) {
    console.log("[DB READY POSTS] Nenhum post pronto encontrado");
  }

  const items = result.rows.map((row) => ({
    ...row,
    captionText: row.caption,
  }));

  items.forEach((item) => {
    console.log("[READY ITEM]", {
      id: item.id,
      workspaceId: item.workspaceId,
      status: item.status,
      scheduledAt: item.scheduledAt,
      videoFile: item.videoFile,
      publishType: item.publishType,
    });
  });

  console.log("======================================");

  return {
    total: items.length,
    items,
  };
}

async function getPostForPublishing(id) {
  const postResult = await query(
    `
      SELECT
        p.id::text AS id,
        p.status::text AS status,
        p.caption,
        p.scheduled_at AS "scheduledAt",
        p.retry_count AS "retryCount",
        p.account_id::text AS "accountId",
        p.workspace_id::text AS "workspaceId",
        COALESCE(p.publish_type, 'reel') AS "publishType",
        p.media_type AS "mediaType",
        p.publish_options AS "publishOptions",
        p.carousel_children AS "carouselChildren",
        p.video_filename AS "videoFile",
        p.source_path AS "sourcePath",
        ia.instagram_id AS "igAccountId",
        COALESCE(ia.access_token, $2) AS "metaToken"
      FROM posts p
      LEFT JOIN instagram_accounts ia
        ON ia.id = p.account_id
      WHERE p.id = $1::uuid
        AND p.deleted_at IS NULL
      LIMIT 1
    `,
    [id, META_FALLBACK_TOKEN ?? null],
  );

  if (postResult.rowCount === 0) {
    return null;
  }

  const mediaResult = await query(
    `
      SELECT
        id::text AS id,
        sort_order AS "sortOrder",
        media_kind AS "mediaKind",
        stored_filename AS "storedFilename",
        original_filename AS "originalFilename",
        storage_path AS "storagePath",
        mime_type AS "mimeType",
        file_size AS "fileSize",
        width,
        height,
        duration_seconds AS "durationSeconds",
        is_carousel_item AS "isCarouselItem"
      FROM post_media_items
      WHERE post_id = $1::uuid
        AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC
    `,
    [id],
  );

  return {
    ...postResult.rows[0],
    mediaItems: mediaResult.rows,
    mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    metaGraphVersion: META_GRAPH_API_VERSION,
    mediaPublicUrl: postResult.rows[0].videoFile
      ? `${MEDIA_PUBLIC_BASE_URL}/pending/${postResult.rows[0].videoFile}`
      : null,
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

  const credentialsSelect = filters.includeCredentials
    ? `ia.access_token AS "metaToken",`
    : "";

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
        p.created_by_user_id::text AS "createdByUserId",
        creator.username AS "createdByUsername",
        creator.display_name AS "createdByDisplayName",
        p.updated_at AS "updatedAt",
        p.retry_count AS "retryCount",
        p.meta_media_id AS "metaMediaId",
        p.account_id::text AS "accountId",
        p.workspace_id::text AS "workspaceId",
        ia.instagram_id AS "igAccountId",
        ${credentialsSelect}
        p.publish_type AS "publishType",
        p.media_type AS "mediaType",
        COALESCE(p.video_filename, primary_media.stored_filename) AS "mediaFile",
        p.video_filename AS "videoFile",
        COALESCE(media_summary.item_count, 0)::integer AS "mediaItemsCount",
        p.media_size AS "mediaSize",
        p.media_deleted_at AS "mediaDeletedAt",
        p.source_path AS "sourcePath"
        FROM posts p
        LEFT JOIN uploads u
          ON u.id = p.upload_id
        LEFT JOIN instagram_accounts ia
          ON ia.id = p.account_id
        LEFT JOIN socialbot_users creator
          ON creator.id = p.created_by_user_id
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
  const groupByPost = filters.groupByPost === true;

  if (filters.postId) {
    where.push(`pe.post_id = $${param++}::uuid`);
    values.push(filters.postId);
  }

  if (filters.eventType) {
    where.push(`pe.event_type = $${param++}`);
    values.push(filters.eventType);
  }

  const limit = toPositiveInt(filters.limit, 100);
  const offset = toNonNegativeInt(filters.offset, 0);
  const countValues = [...values];
  const offsetParam = param + 1;
  values.push(limit, offset);

  const totalResult = await query(
    groupByPost
      ? `
          SELECT COUNT(DISTINCT pe.post_id)::int AS total
          FROM post_events pe
          LEFT JOIN posts p
            ON p.id = pe.post_id
          WHERE ${where.join(" AND ")}
        `
      : `
          SELECT COUNT(*)::int AS total
          FROM post_events pe
          LEFT JOIN posts p
            ON p.id = pe.post_id
          WHERE ${where.join(" AND ")}
        `,
    countValues,
  );

  const result = await query(
    groupByPost
      ? `
          SELECT *
          FROM (
            SELECT DISTINCT ON (pe.post_id)
              pe.id,
              pe.post_id::text AS "postId",
              p.video_filename AS "videoFilename",
              p.caption AS caption,
              pe.event_type AS "eventType",
              pe.actor_user_id::text AS "actorUserId",
              actor.username AS "actorUsername",
              actor.display_name AS "actorDisplayName",
              pe.details,
              pe.created_at AS "createdAt"
            FROM post_events pe
            LEFT JOIN posts p
              ON p.id = pe.post_id
            LEFT JOIN socialbot_users actor
              ON actor.id = pe.actor_user_id
            WHERE ${where.join(" AND ")}
            ORDER BY pe.post_id, pe.created_at DESC, pe.id DESC
          ) grouped_events
          ORDER BY "createdAt" DESC, id DESC
          LIMIT $${param}
          OFFSET $${offsetParam}
        `
      : `
          SELECT
            pe.id,
            pe.post_id::text AS "postId",
            p.video_filename AS "videoFilename",
            p.caption AS caption,
            pe.event_type AS "eventType",
            pe.actor_user_id::text AS "actorUserId",
            actor.username AS "actorUsername",
            actor.display_name AS "actorDisplayName",
            pe.details,
            pe.created_at AS "createdAt"
          FROM post_events pe
          LEFT JOIN posts p
            ON p.id = pe.post_id
          LEFT JOIN socialbot_users actor
            ON actor.id = pe.actor_user_id
          WHERE ${where.join(" AND ")}
          ORDER BY pe.created_at DESC, pe.id DESC
          LIMIT $${param}
          OFFSET $${offsetParam}
        `,
    values,
  );

  return {
    items: result.rows,
    total: Number(totalResult.rows[0]?.total ?? 0),
    limit,
    offset,
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

  if (Object.prototype.hasOwnProperty.call(extra, "publish_options")) {
    fields.push(`publish_options = $${nextIndex++}::jsonb`);
    values.push(JSON.stringify(extra.publish_options ?? {}));
  }

  if (Object.prototype.hasOwnProperty.call(extra, "carousel_children")) {
    fields.push(`carousel_children = $${nextIndex++}::jsonb`);
    values.push(JSON.stringify(extra.carousel_children ?? []));
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
    publish_options: payload.publishOptions ?? {},
    carousel_children:
      payload.publishOptions?.carouselChildren ?? [],
  });
}

async function markPostError(id, errorMessage, currentRetryCount = 0) {
  const now = new Date();
  const nextRetryCount = currentRetryCount + 1;

  const shouldFailPermanently = nextRetryCount >= 2;

  return updateStatus(id, shouldFailPermanently ? "error" : "retrying", {
    processing_finished_at: now,
    error_message: errorMessage,
    last_retry_at: now,
    next_retry_at: shouldFailPermanently
      ? null
      : new Date(now.getTime() + 60_000),
    retry_count: nextRetryCount,
  });
}

async function cancelPostSchedule(id, actorUserId = null) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
    `
      UPDATE posts
      SET
        status = 'canceled',
        scheduled_at = NULL,
        next_retry_at = NULL,
        processing_finished_at = NOW(),
        error_message = 'Cancelado pelo usuario.',
        updated_at = NOW()
      WHERE id = $1::uuid
        AND deleted_at IS NULL
        AND status::text IN (
          'pending',
          'scheduled',
          'queued',
          'retrying',
          'error'
        )
      RETURNING
        id::text AS id,
        workspace_id::text AS "workspaceId",
        status::text AS status
    `,
      [id],
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return {
        found: false,
        payload: {
          message:
            "Post nao encontrado ou status atual nao permite cancelamento.",
        },
      };
    }

    const post = result.rows[0];
    await client.query(
      `
        INSERT INTO post_events (
          workspace_id,
          post_id,
          actor_user_id,
          event_type,
          details
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'canceled', $4::jsonb)
      `,
      [
        post.workspaceId,
        post.id,
        actorUserId,
        JSON.stringify({ source: "posts.internal.cancel" }),
      ],
    );
    await client.query("COMMIT");

    return { found: true, payload: post };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function addPostEvent(
  workspaceId,
  postId,
  eventType,
  details = {},
  actorUserId = null,
) {
  await query(
    `
      INSERT INTO post_events (
        workspace_id,
        post_id,
        actor_user_id,
        event_type,
        details
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4,
        $5::jsonb
      )
    `,
    [workspaceId, postId, actorUserId, eventType, JSON.stringify(details)],
  );

  return true;
}

module.exports = {
  createPostFromUpload,
  createPostFromMediaUpload,
  listReadyPosts,
  getPostForPublishing,
  listPosts,
  listPostEvents,
  markPostProcessing,
  markPostQueued,
  markPostPublished,
  markPostError,
  cancelPostSchedule,
  addPostEvent,
};
