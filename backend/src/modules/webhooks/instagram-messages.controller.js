const service = require("./instagram-messages.service");

async function receiveInstagramWebhook(req, res, next) {
  try {
    const body = req.body;

    console.log("======================================");
    console.log("[INSTAGRAM WEBHOOK RECEIVED]");
    console.log(JSON.stringify(body, null, 2));
    console.log("======================================");

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
    next(error);
  }
}

module.exports = {
  receiveInstagramWebhook,
};
