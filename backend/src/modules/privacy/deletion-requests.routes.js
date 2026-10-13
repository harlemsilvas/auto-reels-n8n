const express = require("express");
const { requireAdminSession, requireCsrf, requireRole, requirePasswordChanged } = require("../auth/admin-auth.middleware");
const service = require("./deletion-requests.service");
const router = express.Router();
// Always authenticate, even when the old dashboard rollout flag is disabled.
router.use(requireAdminSession, requirePasswordChanged, requireRole("admin"));
router.use(express.json({ limit: "16kb" }));
router.post("/", requireCsrf, async (req,res,next) => {
  try { res.status(201).json(await service.create(req.body,req.auth)); } catch(error) { next(error); }
});
router.get("/:id", async (req,res,next) => {
  try { res.json(await service.get(req.params.id)); } catch(error) { next(error); }
});
router.post("/:id/verify", requireCsrf, async (req,res,next) => {
  try { res.json(await service.verify(req.params.id,req.body,req.auth)); } catch(error) { next(error); }
});
router.post("/:id/invalidate-cache", requireCsrf, async (req,res,next) => {
  try { res.json(await service.invalidateCache(req.params.id,req.body)); } catch(error) { next(error); }
});
router.post("/:id/review-backups", requireCsrf, async (req,res,next) => {
  try { res.json(await service.reviewBackups(req.params.id,req.body,req.auth)); } catch(error) { next(error); }
});
router.use((error,_req,res,_next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({code:"INVALID_REQUEST"});
  if (error.type === "entity.too.large") return res.status(413).json({code:"INVALID_REQUEST"});
  const known = new Set(["INVALID_REQUEST","VERIFICATION_REQUIRED","CONVERSATION_NOT_FOUND",
    "REQUEST_NOT_FOUND","REQUEST_SCOPE_CONFLICT","REQUEST_STATE_CONFLICT"]);
  if (known.has(error.code)) return res.status(error.status).json({ code:error.code });
  if (error.code === "23505") return res.status(409).json({ code:"REQUEST_ALREADY_OPEN" });
  res.status(503).json({ code:"PRIVACY_REQUEST_UNAVAILABLE" });
});
module.exports = router;
