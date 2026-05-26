const express = require("express");

const verifyWebhook = require("./instagram-webhook.verify");

const controller = require("./instagram-messages.controller");

const router = express.Router();

/**
 * Meta verification
 */
router.get("/", verifyWebhook);

/**
 * Meta webhook events
 */
router.post("/", controller.receiveInstagramWebhook);

module.exports = router;
