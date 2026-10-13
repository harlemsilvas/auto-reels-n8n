const { META_WEBHOOK_VERIFY_TOKEN } = require("../../config/env");

module.exports = function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (META_WEBHOOK_VERIFY_TOKEN && mode === "subscribe" &&
      typeof token === "string" && token === META_WEBHOOK_VERIFY_TOKEN &&
      typeof challenge === "string" && challenge.length > 0) {
    console.log("[META WEBHOOK VERIFIED]");
    return res.status(200).send(challenge);
  }

  console.log("[META WEBHOOK FAILED]");

  return res.sendStatus(403);
};
