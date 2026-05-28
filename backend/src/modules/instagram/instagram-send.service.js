const { query } = require("../../lib/db");

const apiClient = require("./instagram-api.client");

const repository = require("../webhooks/instagram-messages.repository");

function log(...args) {
  console.log(`[INSTAGRAM SEND ${new Date().toISOString()}]`, ...args);
}

/**
 * ======================================
 * FIND ACCOUNT
 * ======================================
 */

async function findAccount(accountId) {
  const result = await query(
    `
      SELECT
        id::text AS id,
        instagram_id AS "instagramId",
        access_token AS "accessToken",
        nome
      FROM instagram_accounts
      WHERE id = $1::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [accountId],
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

/**
 * ======================================
 * FIND/CREATE CONVERSATION
 * ======================================
 */

async function getConversation({ accountId, recipientId }) {
  return repository.findOrCreateConversation({
    accountId,
    instagramUserId: recipientId,
  });
}

/**
 * ======================================
 * SAVE OUTBOUND MESSAGE
 * ======================================
 */

async function saveOutboundMessage({
  conversationId,
  recipientId,
  accountInstagramId,
  messageText,
  response,
}) {
  await repository.saveMessage({
    conversationId,

    metaMessageId: response?.message_id || response?.messageId || null,

    senderId: accountInstagramId,

    recipientId,

    messageText,

    payload: response,

    sentBy: "bot",
  });
}

/**
 * ======================================
 * SEND TEXT MESSAGE
 * ======================================
 */

async function sendTextMessage({ accountId, recipientId, messageText }) {
  log("======================================");
  log("SEND TEXT MESSAGE");

  const account = await findAccount(accountId);

  if (!account) {
    throw new Error("Instagram account not found.");
  }

  if (!account.accessToken) {
    throw new Error("Instagram access token not found.");
  }

  /**
   * Conversation
   */

  const conversation = await getConversation({
    accountId,
    recipientId,
  });

  /**
   * Typing indicator
   */

  await apiClient.sendTypingIndicator({
    accessToken: account.accessToken,
    recipientId,
  });

  /**
   * Send message
   */

  const response = await apiClient.sendTextMessage({
    accessToken: account.accessToken,
    recipientId,
    messageText,
  });

  /**
   * Save outbound
   */

  await saveOutboundMessage({
    conversationId: conversation.id,
    recipientId,
    accountInstagramId: account.instagramId,
    messageText,
    response,
  });

  log("MESSAGE SENT SUCCESSFULLY");

  log("======================================");

  return response;
}

/**
 * ======================================
 * SEND IMAGE
 * ======================================
 */

async function sendImageMessage({ accountId, recipientId, imageUrl }) {
  log("SEND IMAGE MESSAGE");

  const account = await findAccount(accountId);

  if (!account) {
    throw new Error("Instagram account not found.");
  }

  const conversation = await getConversation({
    accountId,
    recipientId,
  });

  const response = await apiClient.sendImageMessage({
    accessToken: account.accessToken,
    recipientId,
    imageUrl,
  });

  await saveOutboundMessage({
    conversationId: conversation.id,
    recipientId,
    accountInstagramId: account.instagramId,
    messageText: "[image]",
    response,
  });

  return response;
}

/**
 * ======================================
 * SEND QUICK REPLIES
 * ======================================
 */

async function sendQuickReplies({
  accountId,
  recipientId,
  messageText,
  replies,
}) {
  log("SEND QUICK REPLIES");

  const account = await findAccount(accountId);

  if (!account) {
    throw new Error("Instagram account not found.");
  }

  const conversation = await getConversation({
    accountId,
    recipientId,
  });

  const response = await apiClient.sendQuickReplies({
    accessToken: account.accessToken,
    recipientId,
    messageText,
    replies,
  });

  await saveOutboundMessage({
    conversationId: conversation.id,
    recipientId,
    accountInstagramId: account.instagramId,
    messageText,
    response,
  });

  return response;
}

module.exports = {
  sendTextMessage,
  sendImageMessage,
  sendQuickReplies,
};
