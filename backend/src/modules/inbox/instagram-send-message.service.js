const instagramSendService = require("../instagram/instagram-send.service");

async function sendMessage({ accountId, recipientId, messageText }) {
  return instagramSendService.sendTextMessage({
    accountId,
    recipientId,
    messageText,
  });
}

module.exports = {
  sendMessage,
};
