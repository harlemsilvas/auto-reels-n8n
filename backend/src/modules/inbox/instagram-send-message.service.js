const instagramSendService = require("../instagram/instagram-send.service");

async function sendMessage({ conversationId, accountId, recipientId, messageText, requestId }) {
  return instagramSendService.sendTextMessage({
    accountId,
    recipientId,
    messageText,
    conversationId,
    requestId,
  });
}

module.exports = {
  sendMessage,
};
