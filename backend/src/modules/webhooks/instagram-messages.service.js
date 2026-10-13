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
        AND ativo = true
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

// Rebuild the envelope using only events addressed to connected accounts.
// Never save the original mixed-account batch or unrelated change metadata.
async function scopeWebhook(body) {
  const scoped = { object: "instagram", entry: [] };
  if (body?.object !== "instagram" || !Array.isArray(body.entry)) return scoped;
  const accounts = new Map();
  async function allowed(event) {
    const id = event?.message?.is_echo ? event?.sender?.id : event?.recipient?.id;
    if (typeof id !== "string" || !id) return false;
    if (!accounts.has(id)) accounts.set(id, await findAccountByInstagramId(id));
    return Boolean(accounts.get(id));
  }
  for (const entry of body.entry) {
    const messaging = [];
    const changes = [];
    for (const event of Array.isArray(entry?.messaging) ? entry.messaging : []) {
      if (await allowed(event)) messaging.push(event);
    }
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== "messages") continue;
      const value = change.value;
      if (Array.isArray(value?.messaging)) {
        const events = [];
        for (const event of value.messaging) if (await allowed(event)) events.push(event);
        if (events.length) changes.push({ field: "messages", value: { messaging: events } });
      } else if (await allowed(value)) {
        changes.push({ field: "messages", value: {
          sender: value.sender, recipient: value.recipient, message: value.message,
        } });
      }
    }
    if (messaging.length || changes.length) scoped.entry.push({ messaging, changes });
  }
  return scoped;
}

async function processWebhook(body) {
  try {
    log("======================================");
    log("START PROCESS WEBHOOK");

    /**
     * Save only the connected-account portion of the payload
     */

    body = await scopeWebhook(body);
    if (!body.entry.length) return;
    await repository.saveWebhookEvent(body, "instagram_webhook");

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
      "PROCESSING_FAILED",
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

    const message = event?.message;

    if (!message || typeof message !== "object" || Array.isArray(message)) {
      log("Ignoring non-message event");
      return;
    }

    const metaMessageId = message?.mid ?? null;

    const messageText = message?.text ?? null;

    const attachments = message?.attachments ?? [];

    const isEcho = Boolean(message?.is_echo);

    const hasAttachments = attachments.length > 0;

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
      log("Instagram account not found");
      return;
    }

    /**
     * Find/create conversation
     */

    const conversation = await repository.findOrCreateConversation({
      accountId: account.id,
      instagramUserId: senderId,
    });

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

    if (savedMessage?.wasDuplicate) return true;

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
      "PROCESSING_FAILED",
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
      "PROCESSING_FAILED",
    );
  }
}

module.exports = {
  processWebhook,
};
