const express = require("express");

const { inboxStream } = require("./realtime.controller");

const router = express.Router();

/**
 * ======================================
 * HEALTH
 * ======================================
 */

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    module: "realtime",
  });
});

/**
 * ======================================
 * SSE INBOX STREAM
 * ======================================
 */

router.get("/inbox", inboxStream);

module.exports = router;
