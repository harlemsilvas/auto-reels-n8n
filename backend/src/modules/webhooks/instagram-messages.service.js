const repository = require("./instagram-messages.repository");

const { query } = require("../../lib/db");
const realtimeEvents = require("../realtime/realtime.events");

function log(...args) {
  console.log(`[INSTAGRAM WEBHOOK ${new Date().toISOString()}]`, ...args);
}

/**
 * ======================================
 * FIND ACCOUNT BY INSTAGRAM ID
 * ======================================
 */

async function findAccountByInstagramId(instagramId) {
  const result = await query(
    `
      SELECT
        id::text AS id,
        instagram_id AS "instagramId",
        nome
      FROM instagram_accounts
      WHERE instagram_id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [instagramId],
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

/**
 * ======================================
 * PROCESS WEBHOOK
 * ======================================
 */

async function processWebhook(body) {
  try {
    log("======================================");
    log("START PROCESS WEBHOOK");

    /**
     * Save raw payload
     */

    await repository.saveWebhookEvent(body, "instagram_webhook");

    if (!body?.entry?.length) {
      log("No entries found");
      return;
    }

    for (const entry of body.entry) {
      const messaging = entry?.messaging ?? [];
      const changes = entry?.changes ?? [];

      /**
       * ======================================
       * Messaging events
       * ======================================
       */

      for (const event of messaging) {
        await processMessagingEvent(event);
      }

      /**
       * ======================================
       * Graph change events
       * ======================================
       */

      for (const change of changes) {
        await processChangeEvent(change);
      }
    }

    log("END PROCESS WEBHOOK");
    log("======================================");
  } catch (error) {
    console.error(
      "[INSTAGRAM WEBHOOK ERROR]",
      error?.response?.data || error.message,
    );
  }
}

/**
 * ======================================
 * PROCESS MESSAGING EVENT
 * ======================================
 */

async function processMessagingEvent(event) {
  try {
    log("======================================");
    log("PROCESS MESSAGING EVENT");

    const senderId = event?.sender?.id ?? null;

    const recipientId = event?.recipient?.id ?? null;

    const message = event?.message ?? {};

    const metaMessageId = message?.mid ?? null;

    const messageText = message?.text ?? null;

    const attachments = message?.attachments ?? [];

    const isEcho = Boolean(message?.is_echo);

    const hasAttachments = attachments.length > 0;

    log({
      senderId,
      recipientId,
      metaMessageId,
      messageText,
      hasAttachments,
      isEcho,
    });

    /**
     * Ignore echo messages
     * (messages sent by ourselves)
     */

    if (isEcho) {
      log("Ignoring echo message");
      return;
    }

    /**
     * Ignore empty
     */

    if (!senderId || !recipientId) {
      log("Missing sender/recipient");
      return;
    }

    /**
     * Recipient is our IG account
     */

    const account = await findAccountByInstagramId(recipientId);

    if (!account) {
      log("Instagram account not found:", recipientId);
      return;
    }

    log("ACCOUNT FOUND:", {
      id: account.id,
      instagramId: account.instagramId,
      nome: account.nome,
    });

    /**
     * Find/create conversation
     */

    const conversation = await repository.findOrCreateConversation({
      accountId: account.id,
      instagramUserId: senderId,
    });

    log("CONVERSATION:", conversation);

    /**
     * Save message
     */

    // Monta o objeto da mensagem salva para emitir

    const savedMessage = await repository.saveMessage({
      conversationId: conversation.id,
      senderId,
      recipientId,
      messageText: messageText || (hasAttachments ? "[attachment]" : null),
      metaMessageId,
      payload: event,
      sentBy: "user",
    });

    log("MESSAGE SAVED");

    // Emite o evento com o objeto correto
    realtimeEvents.emitNewMessage(savedMessage);

    /**
     * ======================================
     * FUTURE:
     * enqueue
     * n8n
     * AI
     * automation
     * ======================================
     */

    log("END PROCESS MESSAGING EVENT");
    log("======================================");

    return true;
  } catch (error) {
    console.error(
      "[PROCESS MESSAGING EVENT ERROR]",
      error?.response?.data || error.message,
    );
  }
}

/**
 * ======================================
 * PROCESS CHANGE EVENT
 * ======================================
 */

async function processChangeEvent(change) {
  try {
    log("======================================");
    log("PROCESS CHANGE EVENT");

    const field = change?.field;

    log({
      field,
      value: change?.value,
    });

    if (field === "messages") {
      const value = change?.value ?? {};

      const messagingEvents = Array.isArray(value?.messaging)
        ? value.messaging
        : [];

      if (messagingEvents.length > 0) {
        for (const event of messagingEvents) {
          await processMessagingEvent(event);
        }
      } else if (value?.sender?.id && value?.recipient?.id && value?.message) {
        await processMessagingEvent({
          sender: value.sender,
          recipient: value.recipient,
          message: value.message,
        });
      }
    }

    /**
     * Examples:
     * comments
     * mentions
     * story_insights
     * live_comments
     * messages
     */

    log("END PROCESS CHANGE EVENT");
    log("======================================");

    return true;
  } catch (error) {
    console.error(
      "[PROCESS CHANGE EVENT ERROR]",
      error?.response?.data || error.message,
    );
  }
}

module.exports = {
  processWebhook,
};
