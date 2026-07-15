const express = require("express");
const { requirePermission } = require("../auth/admin-auth.middleware");
const { PERMISSIONS } = require("../auth/permissions.service");
const {
  AI_PROVIDERS,
  AI_TASKS,
  GEMINI_MODELS,
  createCredential,
  disableCredential,
  getCredential,
  listCredentials,
  updateCredential,
} = require("./ai-credentials.service");

const router = express.Router();

router.get(
  "/options",
  requirePermission(PERMISSIONS.AI_CREDENTIALS_VIEW),
  (_req, res) => {
    res.json({
      providers: AI_PROVIDERS,
      tasks: AI_TASKS,
      models: { gemini: GEMINI_MODELS },
    });
  },
);

router.get(
  "/",
  requirePermission(PERMISSIONS.AI_CREDENTIALS_VIEW),
  async (req, res, next) => {
    try {
      const result = await listCredentials(req.query ?? {});
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.AI_CREDENTIALS_VIEW),
  async (req, res, next) => {
    try {
      const credential = await getCredential(req.params.id);
      return res.json(credential);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/",
  requirePermission(PERMISSIONS.AI_CREDENTIALS_MANAGE),
  async (req, res, next) => {
    try {
      const credential = await createCredential(req.body ?? {}, req.auth);
      return res.status(201).json(credential);
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/:id",
  requirePermission(PERMISSIONS.AI_CREDENTIALS_MANAGE),
  async (req, res, next) => {
    try {
      const credential = await updateCredential(
        req.params.id,
        req.body ?? {},
        req.auth,
      );
      return res.json(credential);
    } catch (error) {
      return next(error);
    }
  },
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.AI_CREDENTIALS_MANAGE),
  async (req, res, next) => {
    try {
      const credential = await disableCredential(req.params.id, req.auth);
      return res.json(credential);
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
