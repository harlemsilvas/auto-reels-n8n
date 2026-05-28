const express = require("express");

const { sendMessage } = require("./instagram-send-message.controller");

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

module.exports = router;
