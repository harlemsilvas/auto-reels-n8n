const express = require("express");

const service = require("./instagram-send.service");

const router = express.Router();

/**
 * ======================================
 * SEND INSTAGRAM MESSAGE
 * ======================================
 */

router.post("/send", async (req, res, next) => {
  try {
    const { accountId, recipientId, messageText } = req.body;

    if (!accountId) {
      return res.status(400).json({
        message: "accountId is required.",
      });
    }

    if (!recipientId) {
      return res.status(400).json({
        message: "recipientId is required.",
      });
    }

    if (!messageText) {
      return res.status(400).json({
        message: "messageText is required.",
      });
    }

    const response = await service.sendTextMessage({
      accountId,
      recipientId,
      messageText,
    });

    return res.json({
      success: true,
      response,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
