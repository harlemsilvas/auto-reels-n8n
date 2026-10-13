const service = require("./instagram-messages.service");

async function receiveInstagramWebhook(req, res) {
  try {
    const body = req.body;
    /**
     * Responde IMEDIATAMENTE para Meta
     * evitando timeout.
     */
    res.sendStatus(200);

    /**
     * Processa async
     */
    await service.processWebhook(body);
  } catch (error) {
    console.error("[INSTAGRAM WEBHOOK PROCESSING FAILED]");
    if (!res.headersSent) res.sendStatus(500);
  }
}

module.exports = {
  receiveInstagramWebhook,
};
