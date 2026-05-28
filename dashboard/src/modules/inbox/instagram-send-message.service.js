const axios = require("axios");

const { META_GRAPH_API_VERSION } = require("../../config/env");

const { query } = require("../../lib/db");

const GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

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
        c.instagram_user_id,
        ia.instagram_id,
        ia.access_token
      FROM instagram_conversations c

      INNER JOIN instagram_accounts ia
        ON ia.id = c.account_id

      WHERE c.id = $1
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
   * SEND MESSAGE
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

  const insert = await query(
    `
      INSERT INTO instagram_messages (
        conversation_id,
        sender_type,
        message_text,
        created_at
      )
      VALUES (
        $1,
        'bot',
        $2,
        NOW()
      )
      RETURNING *
    `,
    [conversationId, message],
  );

  return insert.rows[0];
}

module.exports = {
  sendInstagramMessage,
};
