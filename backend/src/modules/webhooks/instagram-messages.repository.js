const { query } = require("../../lib/db");

/**
 * ======================================
 * SAVE RAW WEBHOOK EVENT
 * ======================================
 */

async function saveWebhookEvent(payload, eventType = null) {
  const payloadJson = JSON.stringify(payload);

  try {
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
      [eventType, payloadJson],
    );
    return;
  } catch (error) {
    // Compatibilidade com schema antigo sem coluna provider.
    if (error?.code !== "42703") {
      throw error;
    }
  }

  await query(
    `
      INSERT INTO webhook_events (
        event_type,
        payload
      )
      VALUES (
        $1,
        $2::jsonb
      )
    `,
    [eventType, payloadJson],
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
  const payloadJson = JSON.stringify(payload);

  const attempts = [
    {
      senderColumn: "sender_type",
      payloadColumn: "payload",
    },
    {
      senderColumn: "sent_by",
      payloadColumn: "raw_payload",
    },
    {
      senderColumn: "sent_by",
      payloadColumn: "payload",
    },
    {
      senderColumn: "sender_type",
      payloadColumn: "raw_payload",
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const result = await query(
        `
          INSERT INTO instagram_messages (
            conversation_id,
            sender_id,
            recipient_id,
            ${attempt.senderColumn},
            message_text,
            meta_message_id,
            ${attempt.payloadColumn},
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
            ${attempt.senderColumn} AS "sentBy",
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
          payloadJson,
        ],
      );

      return result.rows[0];
    } catch (error) {
      lastError = error;

      if (error?.code !== "42703") {
        throw error;
      }
    }
  }

  throw lastError;
}

module.exports = {
  saveWebhookEvent,
  findOrCreateConversation,
  saveMessage,
};
