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

async function getDashboardSummary() {
  const [pending, publishedCount, errorCount] = await Promise.all([
    listPendingMedia(),
    countVideosInDir(MEDIA_PUBLISHED_DIR),
    countVideosInDir(MEDIA_ERROR_DIR),
  ]);

  const queue = buildDashboardQueueFromPending(pending.items);
  const scheduledCount = queue.filter(
    (item) => item.status === "agendado",
  ).length;

  return {
    metrics: [
      {
        label: "Posts publicados",
        value: String(publishedCount),
        trend: "Total em published",
        tone: "ok",
      },
      {
        label: "Agendados",
        value: String(scheduledCount),
        trend: `${queue.length} na fila atual`,
        tone: "warn",
      },
      {
        label: "Erros",
        value: String(errorCount),
        trend: "Total em error",
        tone: errorCount > 0 ? "danger" : "ok",
      },
      {
        label: "Engajamento medio",
        value: "N/D",
        trend: "Aguardando Insights API",
        tone: "warn",
      },
      {
        label: "Fila ativa",
        value: String(queue.length),
        trend: "Pasta pending monitorada",
        tone: queue.length > 0 ? "ok" : "warn",
      },
    ],
    queue,
  };
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
  getDashboardSummary,
};
