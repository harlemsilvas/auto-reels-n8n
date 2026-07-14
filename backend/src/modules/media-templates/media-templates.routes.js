const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const express = require("express");
const multer = require("multer");
const { MEDIA_PENDING_DIR } = require("../../config/env");
const { requirePermission } = require("../auth/admin-auth.middleware");
const { PERMISSIONS } = require("../auth/permissions.service");
const {
  ALLOWED_EXTENSIONS,
  classifyMediaFile,
} = require("../uploads/post-upload.validation");
const { sanitizeBaseName } = require("../../utils/fs.utils");
const {
  addTemplateItem,
  archiveTemplate,
  approveTextVariant,
  createTemplate,
  createPostFromTemplateTag,
  createTextVariant,
  generateTextVariantDraft,
  getTemplate,
  getTemplateByTag,
  listTemplates,
  removeTemplateItem,
  rejectTextVariant,
  updateTextVariant,
  updateTemplate,
} = require("./media-templates.service");

const router = express.Router();

const templateMediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, MEDIA_PENDING_DIR);
  },
  filename: (_req, file, cb) => {
    const parsed = path.parse(file.originalname);
    const extension = parsed.ext.toLowerCase();
    const safeBase =
      sanitizeBaseName(parsed.name) || `template_media_${Date.now()}`;
    const uniqueName = `${safeBase}_${randomUUID().slice(0, 8)}${extension}`;
    cb(null, uniqueName);
  },
});

const templateMediaUpload = multer({
  storage: templateMediaStorage,
  limits: {
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

async function removeUploadedFile(file) {
  if (!file?.path) return;

  await fs.unlink(file.path).catch((error) => {
    if (error.code !== "ENOENT") {
      console.error("[TEMPLATE MEDIA CLEANUP ERROR]", file.path, error.message);
    }
  });
}

function receiveTemplateMedia(req, res, next) {
  templateMediaUpload.single("file")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    error.status = 400;
    removeUploadedFile(req.file)
      .then(() => next(error))
      .catch(next);
  });
}

router.get(
  "/",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_VIEW),
  async (req, res, next) => {
    try {
      const result = await listTemplates(req.query ?? {});
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/by-tag/:tag",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_VIEW),
  async (req, res, next) => {
    try {
      const template = await getTemplateByTag(
        req.params.tag,
        req.query?.workspaceId,
      );
      return res.json(template);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/by-tag/:tag/posts",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_CREATE_POST),
  async (req, res, next) => {
    try {
      const post = await createPostFromTemplateTag(
        req.params.tag,
        req.body ?? {},
        req.auth,
        req,
      );
      return res.status(201).json(post);
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_VIEW),
  async (req, res, next) => {
    try {
      const template = await getTemplate(req.params.id, {
        includeDetails: true,
      });
      return res.json(template);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_CREATE),
  async (req, res, next) => {
    try {
      const template = await createTemplate(req.body ?? {}, req.auth, req);
      return res.status(201).json(template);
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/:id",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_UPDATE),
  async (req, res, next) => {
    try {
      const template = await updateTemplate(
        req.params.id,
        req.body ?? {},
        req.auth,
        req,
      );
      return res.json(template);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/:id/approve",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_APPROVE),
  async (req, res, next) => {
    try {
      const template = await updateTemplate(
        req.params.id,
        { ...(req.body ?? {}), status: "active" },
        req.auth,
        req,
      );
      return res.json(template);
    } catch (error) {
      return next(error);
    }
  },
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_UPDATE),
  async (req, res, next) => {
    try {
      const template = await archiveTemplate(req.params.id, req.auth, req);
      return res.json(template);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/:id/items",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_UPDATE),
  async (req, res, next) => {
    try {
      const item = await addTemplateItem(
        req.params.id,
        req.body ?? {},
        req.auth,
        req,
      );
      return res.status(201).json(item);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/:id/media-upload",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_UPDATE),
  receiveTemplateMedia,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Arquivo não enviado." });
      }

      const mediaKind = classifyMediaFile(req.file);
      const item = await addTemplateItem(
        req.params.id,
        {
          sortOrder: req.body?.sortOrder,
          mediaKind,
          role: req.body?.role,
          storedFilename: req.file.filename,
          originalFilename: req.file.originalname,
          storagePath: MEDIA_PENDING_DIR,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          notes: req.body?.notes,
        },
        req.auth,
        req,
      );

      return res.status(201).json(item);
    } catch (error) {
      await removeUploadedFile(req.file);
      return next(error);
    }
  },
);

router.delete(
  "/:id/items/:itemId",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_UPDATE),
  async (req, res, next) => {
    try {
      const result = await removeTemplateItem(
        req.params.id,
        req.params.itemId,
        req.auth,
        req,
      );
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/:id/text-variants",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_UPDATE),
  async (req, res, next) => {
    try {
      const variant = await createTextVariant(
        req.params.id,
        req.body ?? {},
        req.auth,
        req,
      );
      return res.status(201).json(variant);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/:id/text-variants/generate",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_GENERATE_AI_TEXT),
  async (req, res, next) => {
    try {
      const variant = await generateTextVariantDraft(
        req.params.id,
        req.body ?? {},
        req.auth,
        req,
      );
      return res.status(201).json(variant);
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/:id/text-variants/:variantId",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_UPDATE),
  async (req, res, next) => {
    try {
      const variant = await updateTextVariant(
        req.params.id,
        req.params.variantId,
        req.body ?? {},
        req.auth,
        req,
      );
      return res.json(variant);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/:id/text-variants/:variantId/approve",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_APPROVE),
  async (req, res, next) => {
    try {
      const variant = await approveTextVariant(
        req.params.id,
        req.params.variantId,
        req.auth,
        req,
      );
      return res.json(variant);
    } catch (error) {
      return next(error);
    }
  },
);

router.delete(
  "/:id/text-variants/:variantId",
  requirePermission(PERMISSIONS.MEDIA_TEMPLATES_UPDATE),
  async (req, res, next) => {
    try {
      const variant = await rejectTextVariant(
        req.params.id,
        req.params.variantId,
        req.auth,
        req,
      );
      return res.json(variant);
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
