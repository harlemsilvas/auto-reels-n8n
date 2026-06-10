const db = require("../../config/env");

async function listPublishedMedia(limit = 100) {
  const result = await db.query(
    `
    SELECT
      id,
      video_filename,
      source_path,
      status,
      published_at,
      media_deleted_at,
      media_size
    FROM posts
    WHERE video_filename IS NOT NULL
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}

async function markMediaDeleted(postId) {
  await db.query(
    `
    UPDATE posts
       SET media_deleted_at = NOW()
     WHERE id = $1
    `,
    [postId],
  );
}

async function getExpiredMedia(days = 3) {
  const result = await db.query(
    `
    SELECT
      id,
      video_filename,
      source_path
    FROM posts
    WHERE
      status = 'published'
      AND media_deleted_at IS NULL
      AND published_at < NOW() - ($1 || ' days')::interval
    `,
    [days],
  );

  return result.rows;
}

module.exports = {
  listPublishedMedia,
  markMediaDeleted,
  getExpiredMedia,
};
