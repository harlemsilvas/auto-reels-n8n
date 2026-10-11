const { query, getPool } = require("../../lib/db");

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

async function findOrCreateConversation({ accountId, instagramUserId, username = null }) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // First-message retries must not create separate conversations before deduplication.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [JSON.stringify([accountId, instagramUserId])]);
    const existing = await client.query(`
      SELECT id::text AS id FROM instagram_conversations
      WHERE account_id = $1::uuid AND instagram_user_id = $2 LIMIT 1
    `, [accountId, instagramUserId]);
    if (existing.rowCount) {
      await client.query("COMMIT");
      return existing.rows[0];
    }
    const created = await client.query(`
      INSERT INTO instagram_conversations (account_id, instagram_user_id, instagram_username, last_message_at)
      VALUES ($1::uuid, $2, $3, NOW()) RETURNING id::text AS id
    `, [accountId, instagramUserId, username]);
    await client.query("COMMIT");
    return created.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * ======================================
 * SAVE MESSAGE
 * ======================================
 */

async function saveMessage({
  conversationId, senderId, recipientId, messageText, metaMessageId, payload, sentBy = "user",
}) {
  const client = await getPool().connect();
  const attempts = [
    { senderColumn: "sender_type", payloadColumn: "payload" },
    { senderColumn: "sent_by", payloadColumn: "raw_payload" },
    { senderColumn: "sent_by", payloadColumn: "payload" },
    { senderColumn: "sender_type", payloadColumn: "raw_payload" },
  ];
  try {
    await client.query("BEGIN");
    // Serialize duplicate checks and cached counter updates for this conversation.
    const conversation = await client.query("SELECT id FROM instagram_conversations WHERE id = $1::uuid FOR UPDATE", [conversationId]);
    if (!conversation.rowCount) throw new Error("Conversation not found.");
    if (metaMessageId) {
      const existing = await client.query(`
        SELECT id::text AS id, conversation_id::text AS "conversationId",
          sender_id AS "senderId", recipient_id AS "recipientId",
          COALESCE(to_jsonb(m)->>'sender_type', to_jsonb(m)->>'sent_by') AS "sentBy",
          message_text AS "messageText", meta_message_id AS "metaMessageId", created_at AS "createdAt"
        FROM instagram_messages m WHERE conversation_id = $1::uuid AND meta_message_id = $2 LIMIT 1
      `, [conversationId, metaMessageId]);
      if (existing.rowCount) {
        await client.query("COMMIT");
        return { ...existing.rows[0], wasDuplicate: true };
      }
    }
    let lastError;
    for (const attempt of attempts) {
      await client.query("SAVEPOINT message_schema");
      try {
        const result = await client.query(`
          INSERT INTO instagram_messages (
            conversation_id, sender_id, recipient_id, ${attempt.senderColumn},
            message_text, meta_message_id, ${attempt.payloadColumn}, created_at, inbox_unread
          ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, NOW(), $8)
          RETURNING id::text AS id, conversation_id::text AS "conversationId",
            sender_id AS "senderId", recipient_id AS "recipientId",
            ${attempt.senderColumn} AS "sentBy", message_text AS "messageText",
            meta_message_id AS "metaMessageId", created_at AS "createdAt"
        `, [conversationId, senderId, recipientId, sentBy, messageText,
          metaMessageId, JSON.stringify(payload), sentBy === "user"]);
        await client.query(`
          UPDATE instagram_conversations SET unread_count = (
            SELECT COUNT(*)::int FROM instagram_messages WHERE conversation_id = $1::uuid AND inbox_unread = TRUE
          ), updated_at = NOW() WHERE id = $1::uuid
        `, [conversationId]);
        await client.query("COMMIT");
        return result.rows[0];
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT message_schema");
        if (error?.code !== "42703") throw error;
        lastError = error;
      }
    }
    throw lastError;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  saveWebhookEvent,
  findOrCreateConversation,
  saveMessage,
};
