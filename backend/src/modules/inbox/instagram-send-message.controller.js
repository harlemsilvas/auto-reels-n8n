const service = require("./instagram-send-message.service");

/**
 * ======================================
 * LOG
 * ======================================
 */

function log(...args) {
  console.log(
    `[INSTAGRAM SEND MESSAGE CONTROLLER ${new Date().toISOString()}]`,
    ...args,
  );
}

/**
 * ======================================
 * SEND MESSAGE
 * ======================================
 */

async function sendMessage(req, res, next) {
  try {
    const { conversationId, accountId, recipientId, messageText } = req.body;

    /**
     * ======================================
     * VALIDATION
     * ======================================
     */

    if (!conversationId) {
      return res.status(400).json({
        message: "conversationId is required.",
      });
    }

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

    if (!messageText?.trim()) {
      return res.status(400).json({
        message: "messageText is required.",
      });
    }

    log("SEND MESSAGE REQUEST", {
      conversationId,
      accountId,
      recipientId,
    });

    /**
     * ======================================
     * SERVICE
     * ======================================
     */

    const result = await service.sendMessage({
      conversationId,
      accountId,
      recipientId,
      messageText: messageText.trim(),
    });

    /**
     * ======================================
     * RESPONSE
     * ======================================
     */

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sendMessage,
};
