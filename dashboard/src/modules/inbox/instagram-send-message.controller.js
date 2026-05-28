const service = require("./instagram-send-message.service");

async function sendMessage(req, res, next) {
  try {
    const { conversationId, message } = req.body;

    const result = await service.sendInstagramMessage({
      conversationId,
      message,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sendMessage,
};
