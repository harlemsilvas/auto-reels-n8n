const { query } = require("../../lib/db");

function log(...args) {
  console.log(`[CONVERSATIONS ${new Date().toISOString()}]`, ...args);
}

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
        COALESCE(
          to_jsonb(m)->>'sender_type',
          to_jsonb(m)->>'sent_by',
          'user'
        ) AS "sentBy",
        m.meta_message_id AS "metaMessageId",
        COALESCE(
          to_jsonb(m)->'payload',
          to_jsonb(m)->'raw_payload'
        ) AS payload,
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
 * LIST CONVERSATIONS
 * ======================================
 */

async function listConversations({ accountId, limit = 50 }) {
  log("LIST CONVERSATIONS");

  const normalizedAccountId =
    typeof accountId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      accountId,
    )
      ? accountId
      : null;

  const result = await query(
    `
      SELECT
        c.id::text AS id,
        c.account_id::text AS "accountId",
        c.instagram_user_id AS "instagramUserId",
        c.instagram_username AS "instagramUsername",
        NULL::text AS "instagramName",
        NULL::text AS "profilePictureUrl",
        COALESCE(last_message.message_text, to_jsonb(c)->>'last_message_text') AS "lastMessageText",
        COALESCE(last_message.created_at, c.last_message_at, c.created_at) AS "lastMessageAt",
        0::int AS "unreadCount",
        COALESCE(stats.messages_count, 0)::int AS "messagesCount",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt",
        ia.nome AS "accountName"
      FROM instagram_conversations c
      LEFT JOIN instagram_accounts ia
        ON ia.id = c.account_id
      LEFT JOIN LATERAL (
        SELECT
          m.message_text,
          m.created_at
        FROM instagram_messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) last_message ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS messages_count
        FROM instagram_messages m
        WHERE m.conversation_id = c.id
      ) stats ON true
      WHERE ($1::uuid IS NULL OR c.account_id = $1::uuid)
      ORDER BY COALESCE(last_message.created_at, c.last_message_at, c.created_at) DESC
      LIMIT $2
    `,
    [normalizedAccountId, limit],
  );

  return {
    total: result.rows.length,
    items: result.rows,
  };
}

/**
 * ======================================
 * MARK CONVERSATION AS READ
 * ======================================
 */

async function markConversationAsRead(conversationId) {
  log("MARK CONVERSATION AS READ", conversationId);

  try {
    await query(
      `
        UPDATE instagram_conversations
        SET unread_count = 0,
            updated_at = NOW()
        WHERE id = $1::uuid
      `,
      [conversationId],
    );
  } catch (error) {
    if (error?.code !== "42703") {
      throw error;
    }

    // Compatibilidade com schema antigo sem unread_count.
    await query(
      `
        UPDATE instagram_conversations
        SET updated_at = NOW()
        WHERE id = $1::uuid
      `,
      [conversationId],
    );
  }

  return {
    ok: true,
    conversationId,
  };
}

module.exports = {
  listMessages,
  listConversations,
  markConversationAsRead,
};
