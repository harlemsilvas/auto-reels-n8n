const { query } = require("../../lib/db");

const apiClient = require("./instagram-api.client");

const repository = require("../webhooks/instagram-messages.repository");
const attempts = require("../inbox/message-send-attempts");

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
  imageMetadata,
}) {
  const payload = imageMetadata ? { ...response, inboxImage: imageMetadata } : response;
  const saved = await repository.saveMessage({
    conversationId,

    metaMessageId: response?.message_id || response?.messageId || null,

    senderId: accountInstagramId,

    recipientId,

    messageText,

    payload,

    sentBy: "bot",
  });
  return imageMetadata ? { ...saved, payload } : saved;
}

/**
 * ======================================
 * SEND TEXT MESSAGE
 * ======================================
 */

async function sendTextMessage({ accountId, recipientId, messageText, conversationId, requestId }) {
  if (typeof messageText !== "string" || !messageText.trim()) throw Object.assign(new Error("messageText is required."), { status: 400 });
  messageText = messageText.trim();
  log("======================================");
  log("SEND TEXT MESSAGE");

  const account = await findAccount(accountId);

  if (!account) {
    throw Object.assign(new Error("Instagram account not found."), { status: 404 });
  }

  if (!account.accessToken) {
    throw Object.assign(new Error("Instagram access token not found."), { status: 400 });
  }

  /**
   * Conversation
   */

  const conversation = conversationId ? { id: conversationId } : await getConversation({
    accountId,
    recipientId,
  });
  const attempt = await attempts.claim({ requestId, conversationId: conversation.id,
    accountId, recipientId, messageText });
  if (!attempt.fresh) return { ...attempt.message, sendAttemptId: attempt.row.id };
  try {

  /**
   * Typing indicator
   */

  try {
    await apiClient.sendTypingIndicator({
      accessToken: account.accessToken,
      recipientId,
    });
  } catch {
    log("Typing indicator unavailable; continuing text send.");
  }

  /**
   * Send message
   */

  let response;
  try {
    response = await apiClient.sendTextMessage({
      accessToken: account.accessToken, recipientId, messageText,
    });
  } catch (error) {
    error.deliveryMayHaveSucceeded = !error.status || error.status >= 500;
    throw error;
  }

  /**
   * Save outbound
   */

  const metaMessageId = response?.message_id || response?.messageId;
  if (typeof metaMessageId !== "string" || !metaMessageId) {
    throw Object.assign(new Error("A Meta nao retornou um ID de mensagem."), { deliveryMayHaveSucceeded: true });
  }
  try {
    await attempts.recordDelivery(attempt.row.id, response, account.instagramId);
  } catch (error) {
    error.deliveryMayHaveSucceeded = true;
    error.metaMessageId = metaMessageId;
    error.confirmedDelivery = { senderId: account.instagramId, response: { message_id: metaMessageId } };
    throw error;
  }
  const outbound = { conversationId: conversation.id, recipientId,
    accountInstagramId: account.instagramId, messageText, response };
  let savedMessage;
  try {
    savedMessage = await saveOutboundMessage(outbound);
  } catch {
    // Retry only local persistence; repository deduplicates by the confirmed Meta ID.
    try {
      savedMessage = await saveOutboundMessage(outbound);
    } catch (error) {
      error.deliveryMayHaveSucceeded = true;
      error.metaMessageId = metaMessageId;
      throw error;
    }
  }

  log("MESSAGE SENT SUCCESSFULLY");

  log("======================================");

  try {
    await attempts.finish(attempt.row.id, savedMessage);
  } catch (error) {
    error.deliveryMayHaveSucceeded = true;
    error.metaMessageId = metaMessageId;
    throw error;
  }
  return { ...savedMessage, sendAttemptId: attempt.row.id };
  } catch (error) {
    await attempts.fail(attempt.row.id, error).catch(() => {});
    if (error.deliveryMayHaveSucceeded) error.attempt = {
      id: attempt.row.id, conversationId: conversation.id, state: "uncertain",
      messageText, createdAt: attempt.row.created_at, metaMessageId: error.metaMessageId ?? null,
    };
    throw error;
  }
}

/**
 * ======================================
 * SEND IMAGE
 * ======================================
 */

async function sendImageMessage({ accountId, recipientId, conversationId, imageUrl, imageMetadata }) {
  log("SEND IMAGE MESSAGE");

  const account = await findAccount(accountId);

  if (!account) {
    throw new Error("Instagram account not found.");
  }

  if (!account.accessToken) throw new Error("Instagram access token not found.");

  const conversation = conversationId ? { id: conversationId } : await getConversation({ accountId, recipientId });

  let delivered = false;
  try {
    const response = await apiClient.sendImageMessage({
      accessToken: account.accessToken, recipientId, imageUrl,
    });
    delivered = true;
    return await saveOutboundMessage({
      conversationId: conversation.id, recipientId, accountInstagramId: account.instagramId,
      messageText: "[image]", response, imageMetadata,
    });
  } catch (error) {
    // Never retry a send automatically when delivery succeeded or its outcome is unknown.
    error.deliveryMayHaveSucceeded = delivered || !error.status || error.status >= 500;
    throw error;
  }
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

  const savedMessage = await saveOutboundMessage({
    conversationId: conversation.id,
    recipientId,
    accountInstagramId: account.instagramId,
    messageText,
    response,
  });

  return savedMessage;
}

module.exports = {
  sendTextMessage,
  sendImageMessage,
  sendQuickReplies,
};
