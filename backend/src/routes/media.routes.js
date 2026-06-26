const express = require("express");
const multer = require("multer");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  MEDIA_PENDING_DIR,
  MULTI_PUBLISH_ENABLED,
} = require("../config/env");
const {
  listPendingMedia,
  saveCaptionForVideo,
} = require("../services/media.service");
const { sanitizeBaseName } = require("../utils/fs.utils");
const {
  createFromUpload,
  createFromMediaUpload,
} = require("../modules/posts/posts.service");
const {
  ALLOWED_EXTENSIONS,
  validatePostUploadInput,
} = require("../modules/uploads/post-upload.validation");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, MEDIA_PENDING_DIR);
  },
  filename: (_req, file, cb) => {
    const parsed = path.parse(file.originalname);
    const safeBase = sanitizeBaseName(parsed.name) || `video_${Date.now()}`;
    const uniqueName = `${safeBase}_${randomUUID().slice(0, 8)}.mp4`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 512,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext !== ".mp4") {
      cb(new Error("Apenas arquivos .mp4 sao permitidos."));
      return;
    }

    cb(null, true);
  },
});

const multiMediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, MEDIA_PENDING_DIR);
  },
  filename: (_req, file, cb) => {
    const parsed = path.parse(file.originalname);
    const extension = parsed.ext.toLowerCase();
    const safeBase = sanitizeBaseName(parsed.name) || `media_${Date.now()}`;
    const uniqueName = `${safeBase}_${randomUUID().slice(0, 8)}${extension}`;
    cb(null, uniqueName);
  },
});

const multiMediaUpload = multer({
  storage: multiMediaStorage,
  limits: {
    files: 10,
    fileSize: 1024 * 1024 * 512,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      cb(new Error("Use apenas arquivos JPG, JPEG, PNG ou MP4."));
      return;
    }

    cb(null, true);
  },
});

async function removeUploadedFiles(files = []) {
  await Promise.all(
    files.map((file) =>
      fs.unlink(file.path).catch((error) => {
        if (error.code !== "ENOENT") {
          console.error("[UPLOAD CLEANUP ERROR]", file.path, error.message);
        }
      }),
    ),
  );
}

function receivePostFiles(req, res, next) {
  multiMediaUpload.array("files", 10)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    error.status = 400;
    removeUploadedFiles(req.files)
      .then(() => next(error))
      .catch(next);
  });
}

router.get("/pending", async (_req, res, next) => {
  try {
    const data = await listPendingMedia();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/capabilities", (_req, res) => {
  res.json({
    uploadPostEnabled: true,
    multiPublishEnabled: MULTI_PUBLISH_ENABLED,
    publishTypes: {
      reel: {
        uploadEnabled: true,
        publishEnabled: true,
        publisher: "n8n",
      },
      feed_image: {
        uploadEnabled: true,
        publishEnabled: MULTI_PUBLISH_ENABLED,
        publisher: "meta",
      },
      feed_carousel: {
        uploadEnabled: true,
        publishEnabled: MULTI_PUBLISH_ENABLED,
        publisher: "meta",
      },
      story_image: {
        uploadEnabled: true,
        publishEnabled: MULTI_PUBLISH_ENABLED,
        publisher: "meta",
      },
      story_video: {
        uploadEnabled: true,
        publishEnabled: MULTI_PUBLISH_ENABLED,
        publisher: "meta",
      },
    },
  });
});

router.post("/upload", upload.single("video"), async (req, res, next) => {
  try {
    const captionText = String(req.body?.captionText ?? "").trim();
    const scheduleAtRaw = String(req.body?.scheduleAt ?? "").trim();
    const workspaceIdRaw = String(req.body?.workspaceId ?? "").trim();
    const workspaceId = workspaceIdRaw || null;
    const scheduleAt = scheduleAtRaw ? new Date(scheduleAtRaw) : null;

    if (!req.file) {
      res.status(400).json({ message: "Arquivo de video nao enviado." });
      return;
    }

    if (!captionText) {
      res.status(400).json({ message: "captionText e obrigatorio." });
      return;
    }

    if (scheduleAtRaw && Number.isNaN(scheduleAt?.getTime())) {
      res.status(400).json({
        message: "scheduleAt invalido. Use formato de data/hora valido.",
      });
      return;
    }

    const itemId = path.parse(req.file.filename).name;
    await saveCaptionForVideo(itemId, captionText);

    await createFromUpload({
      baseName: itemId,
      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storagePath: MEDIA_PENDING_DIR,
      captionText,
      scheduleAt: scheduleAt ? scheduleAt.toISOString() : null,
      workspaceId,
    });

    res.status(201).json({
      message: "Video e legenda enviados para pending.",
      itemId,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/upload-post", receivePostFiles, async (req, res, next) => {
  try {
    const publishType = String(req.body?.publishType ?? "").trim();
    const captionText = String(req.body?.captionText ?? "").trim();
    const scheduleAtRaw = String(req.body?.scheduleAt ?? "").trim();
    const workspaceIdRaw = String(req.body?.workspaceId ?? "").trim();
    const scheduleAt = scheduleAtRaw ? new Date(scheduleAtRaw) : null;
    const files = req.files ?? [];

    if (scheduleAtRaw && Number.isNaN(scheduleAt?.getTime())) {
      const error = new Error(
        "scheduleAt invalido. Use formato de data/hora valido.",
      );
      error.status = 400;
      throw error;
    }

    const mediaKinds = validatePostUploadInput({
      publishType,
      files,
    });

    const result = await createFromMediaUpload({
      publishType,
      captionText,
      scheduleAt: scheduleAt ? scheduleAt.toISOString() : null,
      workspaceId: workspaceIdRaw || null,
      files: files.map((file, index) => ({
        originalFileName: file.originalname,
        storedFileName: file.filename,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath: MEDIA_PENDING_DIR,
        mediaKind: mediaKinds[index],
      })),
    });

    res.status(201).json({
      message: "Post e arquivos recebidos.",
      post: result.payload,
    });
  } catch (error) {
    await removeUploadedFiles(req.files);
    next(error);
  }
});

module.exports = router;
