const express = require("express");

const service = require("./instagram-conversations.service");

const router = express.Router();

/**
 * ======================================
 * LIST CONVERSATIONS
 * ======================================
 */

router.get("/", async (req, res, next) => {
  try {
    const result = await service.listConversations({
      accountId: req.query.accountId,
      limit: Number(req.query.limit ?? 50),
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * ======================================
 * LIST MESSAGES
 * ======================================
 */

router.get("/:conversationId/messages", async (req, res, next) => {
  try {
    const result = await service.listMessages({
      conversationId: req.params.conversationId,
      limit: Number(req.query.limit ?? 100),
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * ======================================
 * MARK AS READ
 * ======================================
 */

router.post("/:conversationId/read", async (req, res, next) => {
  try {
    const result = await service.markConversationAsRead(
      req.params.conversationId,
    );

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
