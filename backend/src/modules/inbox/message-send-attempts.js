const { createHash, randomUUID } = require("node:crypto");
const { query, getPool } = require("../../lib/db");
const repository = require("../webhooks/instagram-messages.repository");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validUUID = value => typeof value === "string" && uuid.test(value);

function failure(status, message) { return Object.assign(new Error(message), { status }); }
function publicAttempt(row) {
  return row ? { id: row.id, conversationId: row.conversation_id, state: row.state,
    messageText: row.message_text, metaMessageId: row.meta_message_id,
    createdAt: row.created_at } : null;
}
function uncertain(row) {
  return Object.assign(failure(502, "Entrega incerta; nao reenviar."), {
    deliveryMayHaveSucceeded: true, attempt: publicAttempt(row),
    metaMessageId: row.meta_message_id,
  });
}

async function savedMessage(row) {
  const result = await query(`SELECT m.id::text AS id, m.conversation_id::text AS "conversationId",
    m.sender_id AS "senderId", m.recipient_id AS "recipientId", m.message_text AS "messageText",
    COALESCE(to_jsonb(m)->>'sender_type', to_jsonb(m)->>'sent_by') AS "sentBy",
    m.meta_message_id AS "metaMessageId", m.created_at AS "createdAt",
    COALESCE(to_jsonb(m)->'payload', to_jsonb(m)->'raw_payload') AS payload
    FROM instagram_messages m WHERE m.conversation_id = $1::uuid
      AND m.id = $2::uuid`, [row.conversation_id, row.message_id]);
  if (!result.rowCount) throw uncertain(row);
  return result.rows[0];
}

async function claim({ requestId = randomUUID(), conversationId, accountId, recipientId, messageText }) {
  if (!validUUID(requestId) || !validUUID(conversationId) || !validUUID(accountId)) {
    throw failure(400, "Identificador de envio invalido.");
  }
  requestId = requestId.toLowerCase();
  conversationId = conversationId.toLowerCase();
  accountId = accountId.toLowerCase();
  const hash = createHash("sha256").update(JSON.stringify([conversationId, messageText])).digest("hex");
  const client = await getPool().connect();
  let row;
  let fresh = false;
  try {
    await client.query("BEGIN");
    const conversation = await client.query(`SELECT id FROM instagram_conversations
      WHERE id=$1::uuid AND account_id=$2::uuid AND instagram_user_id=$3 AND deleted_at IS NULL FOR UPDATE`,
      [conversationId, accountId, recipientId]);
    if (!conversation.rowCount) throw failure(404, "Conversa nao encontrada para esta conta/destinatario.");
    row = (await client.query("SELECT * FROM instagram_send_attempts WHERE id=$1::uuid", [requestId])).rows[0];
    if (row && (row.conversation_id !== conversationId || row.content_hash !== hash)) {
      throw failure(409, "ID de tentativa ja usado em outra mensagem.");
    }
    if (!row) {
      const active = (await client.query(`SELECT * FROM instagram_send_attempts
        WHERE conversation_id=$1::uuid AND state IN ('sending','uncertain') LIMIT 1`, [conversationId])).rows[0];
      if (active) throw uncertain(active);
      // Cross-device retries with a new ID reuse identical confirmed text for 90 seconds.
      const recent = (await client.query(`SELECT * FROM instagram_send_attempts WHERE conversation_id=$1::uuid
        AND content_hash=$2 AND state='sent' AND sent_at > NOW() - INTERVAL '90 seconds'
        ORDER BY sent_at DESC LIMIT 1`, [conversationId, hash])).rows[0];
      row = (await client.query(`INSERT INTO instagram_send_attempts
        (id,conversation_id,content_hash,message_text,recipient_id,state,meta_message_id,message_id,sent_at)
        VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::uuid,$9) RETURNING *`,
        [requestId, conversationId, hash, messageText, recipientId, recent ? "sent" : "sending",
          recent?.meta_message_id ?? null, recent?.message_id ?? null, recent?.sent_at ?? null])).rows[0];
      fresh = !recent;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
  if (fresh) return { fresh: true, row };
  if (row.state === "sent") return { fresh: false, row, message: await savedMessage(row) };
  if (row.state === "rejected" || row.state === "dismissed") {
    throw failure(409, "Tentativa encerrada. Uma nova mensagem exige um novo ID.");
  }
  throw uncertain(row);
}

async function recordDelivery(id, response, senderId) {
  const safeResponse = { message_id: response.message_id ?? response.messageId };
  await query(`UPDATE instagram_send_attempts SET meta_message_id=$2, sender_id=$3,
    response=$4::jsonb, updated_at=NOW() WHERE id=$1::uuid`,
    [id, safeResponse.message_id, senderId, JSON.stringify(safeResponse)]);
}

async function finish(id, message) {
  await query(`UPDATE instagram_send_attempts SET state='sent', message_id=$2::uuid,
    meta_message_id=$3, sent_at=COALESCE(sent_at,NOW()), updated_at=NOW() WHERE id=$1::uuid`,
    [id, message.id, message.metaMessageId]);
}

async function fail(id, error) {
  await query(`UPDATE instagram_send_attempts SET state=$2,
    meta_message_id=COALESCE(meta_message_id,$3),
    response=COALESCE(response,$4::jsonb), sender_id=COALESCE(sender_id,$5), updated_at=NOW()
    WHERE id=$1::uuid AND state IN ('sending','uncertain')`,
    [id, error.deliveryMayHaveSucceeded ? "uncertain" : "rejected", error.metaMessageId ?? null,
      error.confirmedDelivery ? JSON.stringify(error.confirmedDelivery.response) : null,
      error.confirmedDelivery?.senderId ?? null]);
}

async function status(conversationId, requestId) {
  if (!validUUID(conversationId) || (requestId && !validUUID(requestId))) throw failure(400, "Identificador invalido.");
  conversationId = conversationId.toLowerCase();
  requestId = requestId ? requestId.toLowerCase() : null;
  const result = await query(`SELECT a.* FROM instagram_send_attempts a
    JOIN instagram_conversations c ON c.id=a.conversation_id AND c.deleted_at IS NULL
    WHERE a.conversation_id=$1::uuid AND (a.id=$2::uuid OR a.state IN ('sending','uncertain'))
    ORDER BY CASE WHEN a.id=$2::uuid THEN 0 ELSE 1 END, a.created_at DESC LIMIT 1`, [conversationId, requestId || null]);
  const row = result.rows[0];
  return { attempt: publicAttempt(row), message: row?.state === "sent" ? await savedMessage(row) : null };
}

async function reconcile(conversationId, requestId) {
  if (!validUUID(requestId)) throw failure(400, "Identificador invalido.");
  requestId = requestId.toLowerCase();
  const current = await status(conversationId, requestId);
  if (!current.attempt || current.attempt.id !== requestId) throw failure(404, "Tentativa nao encontrada.");
  if (current.attempt.state === "sent") return current;
  const row = (await query(`SELECT * FROM instagram_send_attempts WHERE id=$1::uuid
    AND conversation_id=$2::uuid`, [requestId, conversationId])).rows[0];
  if (!row.meta_message_id || !row.response || !["sending", "uncertain"].includes(row.state)) {
    throw failure(409, "Sem confirmacao Meta para reconciliar; confira o Instagram.");
  }
  const message = await repository.saveMessage({ conversationId, metaMessageId: row.meta_message_id,
    senderId: row.sender_id, recipientId: row.recipient_id, messageText: row.message_text,
    payload: row.response, sentBy: "bot" });
  await finish(requestId, message);
  return { attempt: { ...publicAttempt(row), state: "sent" }, message };
}

async function dismiss(conversationId, requestId, acknowledged) {
  if (!validUUID(conversationId) || !validUUID(requestId) || acknowledged !== true) {
    throw failure(400, "Conferencia manual da entrega obrigatoria.");
  }
  conversationId = conversationId.toLowerCase();
  requestId = requestId.toLowerCase();
  const existing = await query(`SELECT id FROM instagram_send_attempts WHERE id=$1::uuid
    AND conversation_id=$2::uuid`, [requestId, conversationId]);
  if (!existing.rowCount) {
    const conversation = await query(`SELECT id FROM instagram_conversations WHERE id=$1::uuid
      AND deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM instagram_send_attempts
        WHERE conversation_id=$1::uuid AND state IN ('sending','uncertain'))`, [conversationId]);
    if (!conversation.rowCount) throw failure(409, "Conversa indisponivel ou com outra tentativa ativa.");
    // Explicit acknowledgement can clear pre-migration client-only records, never server-active ones.
    return { ok: true };
  }
  const result = await query(`UPDATE instagram_send_attempts a SET state='dismissed', updated_at=NOW()
    FROM instagram_conversations c WHERE c.id=a.conversation_id AND c.deleted_at IS NULL
      AND a.id=$1::uuid AND a.conversation_id=$2::uuid AND a.meta_message_id IS NULL
      AND (a.state='uncertain' OR (a.state='sending' AND a.created_at < NOW()-INTERVAL '5 minutes'))
    RETURNING a.id`, [requestId, conversationId]);
  if (!result.rowCount) throw failure(409, "Tentativa ainda ativa ou ja confirmada; nao pode ser descartada.");
  return { ok: true };
}

module.exports = { claim, recordDelivery, finish, fail, status, reconcile, dismiss };
