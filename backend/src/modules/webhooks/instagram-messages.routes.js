const express = require("express");

const verifyWebhook = require("./instagram-webhook.verify");

const controller = require("./instagram-messages.controller");
const { rawWebhookBody, verifySignature, webhookBodyError } = require("./instagram-webhook.signature");

const router = express.Router();

/**
 * Meta verification
 */
router.get("/", verifyWebhook);

/**
 * Meta webhook events
 */
router.post("/", rawWebhookBody, verifySignature, controller.receiveInstagramWebhook);
router.use(webhookBodyError);

module.exports = router;
