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
  metaMessageId,
  senderId,
  recipientId,
  messageText,
  payload,
  sentBy,
}) {
  await query(
    `
      INSERT INTO instagram_messages (
        conversation_id,
        meta_message_id,
        sender_id,
        recipient_id,
        message_text,
        raw_payload,
        sent_by
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7
      )
      ON CONFLICT (meta_message_id)
      DO NOTHING
    `,
    [
      conversationId,
      metaMessageId,
      senderId,
      recipientId,
      messageText,
      JSON.stringify(payload),
      sentBy,
    ],
  );

  await query(
    `
      UPDATE instagram_conversations
      SET
        last_message_at = NOW(),
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [conversationId],
  );
}

module.exports = {
  saveWebhookEvent,
  findOrCreateConversation,
  saveMessage,
};
