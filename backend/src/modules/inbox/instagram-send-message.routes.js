const express = require("express");

const { sendMessage } = require("./instagram-send-message.controller");
const attempts = require("./message-send-attempts");

const router = express.Router();

/**
 * ======================================
 * HEALTH
 * ======================================
 */

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    module: "instagram-send-message",
  });
});

/**
 * ======================================
 * SEND MESSAGE
 * ======================================
 */

router.post("/send", sendMessage);

router.get("/attempts/:conversationId", async (req, res, next) => {
  try { res.json(await attempts.status(req.params.conversationId, req.query.requestId)); }
  catch (error) { next(error); }
});
router.post("/attempts/:conversationId/reconcile", async (req, res, next) => {
  try { res.json(await attempts.reconcile(req.params.conversationId, req.body?.requestId)); }
  catch (error) { next(error); }
});
router.post("/attempts/:conversationId/dismiss", async (req, res, next) => {
  try { res.json(await attempts.dismiss(req.params.conversationId, req.body?.requestId, req.body?.acknowledged)); }
  catch (error) { next(error); }
});

module.exports = router;
