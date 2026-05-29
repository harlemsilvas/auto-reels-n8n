const { query } = require("../../lib/db");

/**
 * ======================================
 * SAVE RAW WEBHOOK EVENT
 * ======================================
 */

async function saveWebhookEvent(payload, eventType = null) {
  await query(
    `
      INSERT INTO webhook_events (
        provider,
        event_type,
        payload
      )
      VALUES (
        'instagram',
        $1,
        $2::jsonb
      )
    `,
    [eventType, JSON.stringify(payload)],
  );
}

/**
 * ======================================
 * FIND OR CREATE CONVERSATION
 * ======================================
 */

async function findOrCreateConversation({
  accountId,
  instagramUserId,
  username = null,
}) {
  const existing = await query(
    `
      SELECT
        id::text AS id
      FROM instagram_conversations
      WHERE account_id = $1::uuid
        AND instagram_user_id = $2
      LIMIT 1
    `,
    [accountId, instagramUserId],
  );

  if (existing.rowCount > 0) {
    return existing.rows[0];
  }

  const created = await query(
    `
      INSERT INTO instagram_conversations (
        account_id,
        instagram_user_id,
        instagram_username,
        last_message_at
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        NOW()
      )
      RETURNING id::text AS id
    `,
    [accountId, instagramUserId, username],
  );

  return created.rows[0];
}

/**
 * ======================================
 * SAVE MESSAGE
 * ======================================
 */

async function saveMessage({
  conversationId,
  senderId,
  recipientId,
  messageText,
  metaMessageId,
  payload,
  sentBy = "user",
}) {
  const result = await query(
    `
      INSERT INTO instagram_messages (
        conversation_id,
        sender_id,
        recipient_id,
        sender_type,
        message_text,
        meta_message_id,
        payload,
        created_at
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb,
        NOW()
      )
      RETURNING
        id::text AS id,
        conversation_id::text AS "conversationId",
        sender_id AS "senderId",
        recipient_id AS "recipientId",
        sender_type AS "sentBy",
        message_text AS "messageText",
        meta_message_id AS "metaMessageId",
        created_at AS "createdAt"
    `,
    [
      conversationId,
      senderId,
      recipientId,
      sentBy,
      messageText,
      metaMessageId,
      JSON.stringify(payload),
    ],
  );

  return result.rows[0];
}

module.exports = {
  saveWebhookEvent,
  findOrCreateConversation,
  saveMessage,
};
