const express = require("express");
const multer = require("multer");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { MEDIA_PENDING_DIR } = require("../config/env");
const {
  listPendingMedia,
  saveCaptionForVideo,
} = require("../services/media.service");
const { sanitizeBaseName } = require("../utils/fs.utils");
const { createFromUpload } = require("../modules/posts/posts.service");

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

router.get("/pending", async (_req, res, next) => {
  try {
    const data = await listPendingMedia();
    res.json(data);
  } catch (error) {
    next(error);
  }
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

module.exports = router;
