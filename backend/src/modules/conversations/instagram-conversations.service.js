const { query, getPool } = require("../../lib/db");
const { lookupProfile } = require("./instagram-profile-cache");

function log(...args) {
  console.log(`[CONVERSATIONS ${new Date().toISOString()}]`, ...args);
}

function attachmentKind(payload) {
  if (payload?.inboxImage?.filename) return "image";
  const attachments = payload?.message?.attachments ?? payload?.attachments;
  if (!Array.isArray(attachments)) return null;
  const types = attachments.map((item) => item?.type).filter((type) => typeof type === "string" && type.trim());
  if (!types.length) return null;
  if (types.length > 1) return "attachments";
  return ["image", "video", "audio", "file"].includes(types[0]) ? types[0] : "attachment";
}

function attachmentSummary(payload) {
  const kind = attachmentKind(payload);
  if (kind === "attachments") return "[Anexos]";
  const labels = { image: "[Imagem]", video: "[Video]", audio: "[Audio]", file: "[Arquivo]" };
  return kind ? (Object.hasOwn(labels, kind) ? labels[kind] : "[Anexo]") : null;
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
      SELECT recent.* FROM (
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
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $2
      ) recent ORDER BY "createdAt" ASC, id ASC
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
        NULLIF(BTRIM(to_jsonb(c)->>'instagram_name'), '') AS "instagramName",
        NULL::text AS "profilePictureUrl",
        CASE WHEN last_message.id IS NOT NULL THEN last_message.message_text
          ELSE to_jsonb(c)->>'last_message_text' END AS "lastMessageText",
        last_message.payload AS "_lastMessagePayload",
        COALESCE(last_message.created_at, c.last_message_at, c.created_at) AS "lastMessageAt",
        COALESCE(stats.unread_count, 0)::int AS "unreadCount",
        COALESCE(stats.messages_count, 0)::int AS "messagesCount",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt",
        ia.nome AS "accountName",
        CASE WHEN to_jsonb(ia)->>'deleted_at' IS NULL
          AND (to_jsonb(ia)->>'ativo') IS DISTINCT FROM 'false'
          THEN to_jsonb(ia)->>'access_token' END AS "_accessToken"
      FROM instagram_conversations c
      LEFT JOIN instagram_accounts ia
        ON ia.id = c.account_id
      LEFT JOIN LATERAL (
        SELECT
          m.id, NULLIF(BTRIM(m.message_text), '') AS message_text,
          m.created_at, m.payload
        FROM (
          SELECT m.id, m.message_text, m.created_at,
            COALESCE(to_jsonb(m)->'payload', to_jsonb(m)->'raw_payload') AS payload
          FROM instagram_messages m WHERE m.conversation_id = c.id
        ) m
        WHERE NULLIF(BTRIM(m.message_text), '') IS NOT NULL
          OR NULLIF(m.payload->'inboxImage'->>'filename', '') IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(COALESCE(m.payload->'message'->'attachments', m.payload->'attachments')) = 'array'
                THEN COALESCE(m.payload->'message'->'attachments', m.payload->'attachments')
                ELSE '[]'::jsonb END
            ) attachment WHERE jsonb_typeof(attachment->'type') = 'string'
              AND NULLIF(BTRIM(attachment->>'type'), '') IS NOT NULL
          )
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) last_message ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS messages_count,
          COUNT(*) FILTER (WHERE m.inbox_unread = TRUE) AS unread_count
        FROM instagram_messages m
        WHERE m.conversation_id = c.id
      ) stats ON true
      WHERE c.deleted_at IS NULL AND ($1::uuid IS NULL OR c.account_id = $1::uuid)
      ORDER BY COALESCE(last_message.created_at, c.last_message_at, c.created_at) DESC, c.id DESC
      LIMIT $2
    `,
    [normalizedAccountId, limit],
  );

  return {
    total: result.rows.length,
    items: await Promise.all(result.rows.map(async ({ _lastMessagePayload, _accessToken, ...conversation }) => {
      const profile = conversation.instagramName && conversation.instagramUsername ? null : await lookupProfile({
        accountId: conversation.accountId,
        instagramUserId: conversation.instagramUserId,
        accessToken: _accessToken,
      });
      return {
        ...conversation,
        instagramName: conversation.instagramName || profile?.name || null,
        instagramUsername: conversation.instagramUsername || profile?.username || null,
        lastMessageText: conversation.lastMessageText || attachmentSummary(_lastMessagePayload),
        lastMessageKind: (!conversation.lastMessageText || ["[image]", "[attachment]"].includes(conversation.lastMessageText)) && attachmentKind(_lastMessagePayload)
          ? attachmentKind(_lastMessagePayload) : conversation.lastMessageText ? "text" : null,
      };
    })),
  };
}

/**
 * ======================================
 * MARK CONVERSATION AS READ
 * ======================================
 */

async function markConversationAsRead(conversationId, messageIds) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(conversationId) || (messageIds !== undefined &&
      (!Array.isArray(messageIds) || messageIds.length > 500 || messageIds.some((id) => typeof id !== "string" || !uuid.test(id))))) {
    const error = new Error("Invalid conversationId or messageIds.");
    error.status = 400;
    throw error;
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const conversation = await client.query(
      "SELECT id FROM instagram_conversations WHERE id = $1::uuid AND deleted_at IS NULL FOR UPDATE",
      [conversationId],
    );
    if (!conversation.rowCount) {
      const error = new Error("Conversation not found.");
      error.status = 404;
      throw error;
    }
    // New clients acknowledge only displayed IDs; legacy clients acknowledge the current snapshot.
    await client.query(`
      UPDATE instagram_messages SET inbox_unread = FALSE
      WHERE conversation_id = $1::uuid AND inbox_unread = TRUE
        AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))
    `, [conversationId, messageIds ?? null]);
    const result = await client.query(`
      UPDATE instagram_conversations SET unread_count = (
        SELECT COUNT(*)::int FROM instagram_messages WHERE conversation_id = $1::uuid AND inbox_unread = TRUE
      ), updated_at = NOW() WHERE id = $1::uuid
      RETURNING unread_count AS "unreadCount"
    `, [conversationId]);
    await client.query("COMMIT");
    return { ok: true, conversationId, unreadCount: result.rows[0].unreadCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listMessages,
  listConversations,
  markConversationAsRead,
};
