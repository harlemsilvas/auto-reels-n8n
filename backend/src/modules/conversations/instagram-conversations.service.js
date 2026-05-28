/**
 * ======================================
 * GET CONVERSATION MESSAGES
 * ======================================
 */

async function listMessages({ conversationId, limit = 100 }) {
  log("LIST MESSAGES");

  const result = await query(
    `
      SELECT
        m.id::text AS id,

        m.conversation_id::text AS "conversationId",

        m.sender_id AS "senderId",

        m.recipient_id AS "recipientId",

        m.message_text AS "messageText",

        m.sender_type AS "sentBy",

        m.meta_message_id AS "metaMessageId",

        m.created_at AS "createdAt"

      FROM instagram_messages m

      WHERE m.conversation_id = $1::uuid

      ORDER BY m.created_at ASC

      LIMIT $2
    `,
    [conversationId, limit],
  );

  return {
    total: result.rows.length,
    items: result.rows,
  };
}

/**
 * ======================================
 * LIST CONVERSATIONS (stub)
 * ======================================
 */
async function listConversations({ accountId, limit = 50 }) {
  // TODO: Implementar busca real de conversas
  return { total: 0, items: [] };
}

module.exports = {
  listMessages,
  listConversations,
};
