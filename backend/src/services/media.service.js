const fs = require("node:fs/promises");
const path = require("node:path");
const {
  MEDIA_PENDING_DIR,
  MEDIA_PUBLISHED_DIR,
  MEDIA_ERROR_DIR,
} = require("../config/env");
const {
  fileBaseName,
  isCaptionFile,
  isVideoFile,
} = require("../utils/fs.utils");
const { query } = require("../lib/db");

async function listMediaFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

async function countVideosInDir(dirPath) {
  const files = await listMediaFiles(dirPath);
  return files.filter(isVideoFile).length;
}

function toPendingItem(baseName, videoFile, captionFile, createdAt) {
  return {
    id: baseName,
    baseName,
    videoFile,
    captionFile,
    createdAt,
  };
}

async function listPendingMedia() {
  const files = await listMediaFiles(MEDIA_PENDING_DIR);
  const videoFiles = files.filter(isVideoFile);
  const captionFiles = new Set(files.filter(isCaptionFile));

  const items = await Promise.all(
    videoFiles.map(async (videoFile) => {
      const baseName = fileBaseName(videoFile);
      const captionName = `${baseName}.txt`;
      const captionFile = captionFiles.has(captionName) ? captionName : null;
      const videoPath = path.join(MEDIA_PENDING_DIR, videoFile);
      const stats = await fs.stat(videoPath);
      const createdAtMs = Math.max(
        stats.birthtimeMs || 0,
        stats.ctimeMs || 0,
        stats.mtimeMs || 0,
      );

      return toPendingItem(
        baseName,
        videoFile,
        captionFile,
        new Date(createdAtMs).toISOString(),
      );
    }),
  );

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    pendingPath: MEDIA_PENDING_DIR,
    items,
  };
}

async function saveCaptionForVideo(baseName, captionText) {
  const captionPath = path.join(MEDIA_PENDING_DIR, `${baseName}.txt`);
  await fs.writeFile(captionPath, `${captionText.trim()}\n`, "utf-8");
}

async function readCaptionForBaseName(baseName) {
  const captionPath = path.join(MEDIA_PENDING_DIR, `${baseName}.txt`);

  try {
    const content = await fs.readFile(captionPath, "utf-8");
    return content.trim();
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function moveIfExists(sourcePath, targetPath) {
  try {
    await fs.rename(sourcePath, targetPath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function movePendingItem(baseName, targetDir) {
  const videoSourcePath = path.join(MEDIA_PENDING_DIR, `${baseName}.mp4`);
  const captionSourcePath = path.join(MEDIA_PENDING_DIR, `${baseName}.txt`);

  const videoTargetPath = path.join(targetDir, `${baseName}.mp4`);
  const captionTargetPath = path.join(targetDir, `${baseName}.txt`);

  const [movedVideo, movedCaption] = await Promise.all([
    moveIfExists(videoSourcePath, videoTargetPath),
    moveIfExists(captionSourcePath, captionTargetPath),
  ]);

  return {
    movedVideo,
    movedCaption,
  };
}

async function movePendingItemToPublished(baseName) {
  return movePendingItem(baseName, MEDIA_PUBLISHED_DIR);
}

async function movePendingItemToError(baseName) {
  return movePendingItem(baseName, MEDIA_ERROR_DIR);
}

function buildDashboardQueueFromPending(pendingItems) {
  return pendingItems.slice(0, 10).map((item) => {
    const createdAt = new Date(item.createdAt);
    const hh = String(createdAt.getHours()).padStart(2, "0");
    const mm = String(createdAt.getMinutes()).padStart(2, "0");

    return {
      id: item.id,
      accountName: "Conta padrao",
      videoName: item.videoFile,
      scheduledAt: `${hh}:${mm}`,
      status: item.captionFile ? "agendado" : "aguardando",
    };
  });
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function buildDashboardQueueFromPosts(rows) {
  return rows.map((row) => ({
    id: row.id,
    accountName: row.accountName ?? "Conta nao vinculada",
    videoName: row.videoName ?? "",
    scheduledAt: toIsoString(row.scheduledAt),
    status: row.status,
  }));
}

async function getDashboardSummaryFromPosts() {
  const [countersResult, queueResult] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'published')::int AS published,
        COUNT(*) FILTER (WHERE status IN ('pending', 'scheduled'))::int AS pending,
        COUNT(*) FILTER (WHERE status IN ('queued', 'processing'))::int AS processing,
        COUNT(*) FILTER (WHERE status IN ('error', 'retrying'))::int AS errors,
        COUNT(*) FILTER (
          WHERE status IN (
            'pending',
            'scheduled',
            'queued',
            'processing',
            'retrying'
          )
        )::int AS active_queue
      FROM posts
      WHERE deleted_at IS NULL
    `),
    query(`
      SELECT
        p.id::text AS id,
        p.status::text AS status,
        p.video_filename AS "videoName",
        p.scheduled_at AS "scheduledAt",
        p.updated_at AS "updatedAt",
        ia.nome AS "accountName"
      FROM posts p
      LEFT JOIN instagram_accounts ia
        ON ia.id = p.account_id
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 20
    `),
  ]);

  const counters = countersResult.rows[0] ?? {};
  const publishedCount = Number(counters.published ?? 0);
  const pendingCount = Number(counters.pending ?? 0);
  const processingCount = Number(counters.processing ?? 0);
  const errorCount = Number(counters.errors ?? 0);
  const activeQueueCount = Number(counters.active_queue ?? 0);

  return {
    metrics: [
      {
        label: "Posts publicados",
        value: String(publishedCount),
        trend: "Status published em posts",
        tone: "ok",
      },
      {
        label: "Pendentes",
        value: String(pendingCount),
        trend: "Status pending ou scheduled",
        tone: pendingCount > 0 ? "warn" : "ok",
      },
      {
        label: "Processando",
        value: String(processingCount),
        trend: "Status queued ou processing",
        tone: processingCount > 0 ? "warn" : "ok",
      },
      {
        label: "Erros",
        value: String(errorCount),
        trend: "Status error ou retrying",
        tone: errorCount > 0 ? "danger" : "ok",
      },
      {
        label: "Fila ativa",
        value: String(activeQueueCount),
        trend: "Pendentes, fila, processamento e retry",
        tone: activeQueueCount > 0 ? "ok" : "warn",
      },
    ],
    queue: buildDashboardQueueFromPosts(queueResult.rows),
  };
}

async function getDashboardSummary() {
  return getDashboardSummaryFromPosts();
}

async function getFileOperationalCounts() {
  const [pending, published, error] = await Promise.all([
    listPendingMedia(),
    countVideosInDir(MEDIA_PUBLISHED_DIR),
    countVideosInDir(MEDIA_ERROR_DIR),
  ]);

  return {
    pending: pending.items.length,
    published,
    error,
  };
}

module.exports = {
  listPendingMedia,
  saveCaptionForVideo,
  readCaptionForBaseName,
  movePendingItemToPublished,
  movePendingItemToError,
  getFileOperationalCounts,
  getDashboardSummaryFromPosts,
  getDashboardSummary,
};
