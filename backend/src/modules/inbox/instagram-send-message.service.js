// backend/src/modules/webhooks/instagram-messages.service.js

const axios = require("axios");

const { META_GRAPH_API_VERSION } = require("../../config/env");

const { query } = require("../../lib/db");

const realtimeEvents = require("../realtime/realtime.events");

const GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

/**
 * ======================================
 * SEND INSTAGRAM MESSAGE
 * ======================================
 */

async function sendInstagramMessage({ conversationId, message }) {
  /**
   * ======================================
   * GET CONVERSATION
   * ======================================
   */

  const result = await query(
    `
      SELECT
        c.id,
        c.account_id,
        c.instagram_user_id,

        ia.instagram_id,
        ia.access_token

      FROM instagram_conversations c

      INNER JOIN instagram_accounts ia
        ON ia.id = c.account_id

      WHERE c.id = $1::uuid

      LIMIT 1
    `,
    [conversationId],
  );

  if (!result.rows.length) {
    throw new Error("Conversa não encontrada.");
  }

  const conversation = result.rows[0];

  /**
   * ======================================
   * SEND TO META API
   * ======================================
   */

  await axios.post(
    `${GRAPH_URL}/${conversation.instagram_id}/messages`,
    {
      recipient: {
        id: conversation.instagram_user_id,
      },

      message: {
        text: message,
      },

      messaging_type: "RESPONSE",
    },
    {
      params: {
        access_token: conversation.access_token,
      },
    },
  );

  /**
   * ======================================
   * SAVE MESSAGE
   * ======================================
   */

  const insertResult = await query(
    `
      INSERT INTO instagram_messages (
        conversation_id,
        sender_id,
        recipient_id,
        sender_type,
        message_text,
        created_at
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        'bot',
        $4,
        NOW()
      )
      RETURNING *
    `,
    [
      conversationId,
      conversation.instagram_id,
      conversation.instagram_user_id,
      message,
    ],
  );

  const savedMessage = insertResult.rows[0];

  /**
   * ======================================
   * REALTIME EVENT
   * ======================================
   */

  realtimeEvents.emitNewMessage(savedMessage);

  return savedMessage;
}

module.exports = {
  sendInstagramMessage,
};
