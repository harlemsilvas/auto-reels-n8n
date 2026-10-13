// Demonstration only. The allowlisted disposable schema prevents use on public/VPS data.
function demoSchema(schema) {
  if (!/^mr05_deletion_demo_[a-f0-9]{32}$/.test(schema)) throw Error("DEMO_SCHEMA_REQUIRED");
  return schema;
}

function containsId(value, id) {
  if (value === id) return true;
  if (Array.isArray(value)) return value.some(item => containsId(item, id));
  return value && typeof value === "object" && Object.values(value).some(item => containsId(item, id));
}

// Remove only events with the exact account/subject pair, never an entire mixed batch.
function redactWebhook(body, account, subject) {
  if (!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray(body.entry)) {
    if (containsId(body, subject)) throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
    return { body, removed: 0 };
  }
  const result = structuredClone(body);
  let removed = 0;
  function retain(event) {
    const sender = event?.sender?.id, recipient = event?.recipient?.id;
    if ((sender === subject && recipient === account) || (sender === account && recipient === subject)) {
      removed++;
      return false;
    }
    // Same subject on another account is outside this deletion's scope.
    if ((sender === subject && typeof recipient === "string" && recipient !== account) ||
        (recipient === subject && typeof sender === "string" && sender !== account)) return true;
    if (containsId(event, subject)) throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
    return true;
  }
  for (const entry of result.entry) {
    if ((!Array.isArray(entry?.messaging) && containsId(entry?.messaging, subject)) ||
        (!Array.isArray(entry?.changes) && containsId(entry?.changes, subject)))
      throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
    if (Array.isArray(entry?.messaging)) entry.messaging = entry.messaging.filter(retain);
    if (Array.isArray(entry?.changes)) entry.changes = entry.changes.filter(change => {
      if (change?.field !== "messages") {
        if (containsId(change, subject)) throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
        return true;
      }
      if (Array.isArray(change.value?.messaging)) {
        change.value.messaging = change.value.messaging.filter(retain);
        return change.value.messaging.length > 0;
      }
      return retain(change.value);
    });
    // Unknown metadata must not silently retain a second copy of the subject.
    const { messaging, changes, ...metadata } = entry || {};
    if (containsId(metadata, subject)) throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
  }
  const { entry, ...metadata } = result;
  if (containsId(metadata, subject)) throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
  return { body: result, removed };
}

async function deleteDemoConversation(pool, { schema, accountId, subjectId, verified, requestId,
  beforeCommit = async () => {} }) {
  demoSchema(schema);
  if (verified !== true || !/^[a-f0-9-]{36}$/.test(requestId || "")) throw Error("VERIFIED_DEMO_REQUEST_REQUIRED");
  if (typeof subjectId !== "string" || !subjectId) throw Error("SUBJECT_REQUIRED");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [schema + requestId]);
    const prior = await client.query(`SELECT account_id, subject_id, counts FROM ${schema}.deletion_audit WHERE request_id=$1`, [requestId]);
    if (prior.rowCount) {
      if (prior.rows[0].account_id !== accountId || prior.rows[0].subject_id !== subjectId)
        throw Error("REQUEST_SCOPE_CONFLICT");
      await client.query("ROLLBACK");
      return { ...prior.rows[0].counts, replay: true };
    }
    const account = (await client.query(`SELECT instagram_id FROM ${schema}.instagram_accounts WHERE id=$1 FOR UPDATE`, [accountId])).rows[0];
    if (!account) throw Error("ACCOUNT_NOT_FOUND");
    const conversations = (await client.query(`SELECT id FROM ${schema}.instagram_conversations
      WHERE account_id=$1 AND instagram_user_id=$2 FOR UPDATE`, [accountId, subjectId])).rows;
    const ids = conversations.map(row => row.id);
    const attempts = (await client.query(`SELECT a.*, m.meta_message_id AS linked_meta_id,
      m.conversation_id AS linked_conversation_id FROM ${schema}.instagram_send_attempts a
      LEFT JOIN ${schema}.instagram_messages m ON m.id=a.message_id
      WHERE a.conversation_id=ANY($1::uuid[]) FOR UPDATE OF a`, [ids])).rows;
    if (attempts.some(a => !["sent", "rejected", "dismissed"].includes(a.state) ||
      (a.state === "sent" && (!a.meta_message_id || a.linked_meta_id !== a.meta_message_id ||
        a.linked_conversation_id !== a.conversation_id)) ||
      (a.state !== "sent" && (a.meta_message_id || a.message_id)))) throw Error("DELIVERY_REQUIRES_REVIEW");
    const messages = (await client.query(`SELECT id, payload->'inboxImage'->>'filename' AS filename
      FROM ${schema}.instagram_messages WHERE conversation_id=ANY($1::uuid[]) FOR UPDATE`, [ids])).rows;
    const foreignAttempts = await client.query(`SELECT id FROM ${schema}.instagram_send_attempts
      WHERE message_id=ANY($1::uuid[]) AND NOT (conversation_id=ANY($2::uuid[])) FOR UPDATE`,
      [messages.map(m => m.id), ids]);
    if (foreignAttempts.rowCount) throw Error("CROSS_CONVERSATION_REFERENCE");
    const files = [...new Set(messages.map(m => m.filename).filter(Boolean))];
    const references = (await client.query(`SELECT filename FROM ${schema}.product_media
      UNION ALL SELECT payload->'inboxImage'->>'filename' FROM ${schema}.instagram_messages
      WHERE NOT (conversation_id=ANY($1::uuid[]))`, [ids])).rows;
    const shared = new Set(references.map(row => row.filename));
    const counts = { conversations: ids.length, messages: messages.length, attempts: attempts.length,
      webhookEventsRedacted: 0, webhookItemsRemoved: 0,
      sharedFilesPreserved: files.filter(name => shared.has(name)).length,
      privateFilesRequireSeparateCleanup: files.filter(name => !shared.has(name)).length };
    const webhooks = (await client.query(`SELECT id,payload FROM ${schema}.webhook_events FOR UPDATE`)).rows;
    for (const webhook of webhooks) {
      const filtered = redactWebhook(webhook.payload, account.instagram_id, subjectId);
      if (filtered.removed) {
        await client.query(`UPDATE ${schema}.webhook_events SET payload=$2::jsonb WHERE id=$1`, [webhook.id, JSON.stringify(filtered.body)]);
        counts.webhookEventsRedacted++;
        counts.webhookItemsRemoved += filtered.removed;
      }
    }
    await client.query(`DELETE FROM ${schema}.instagram_send_attempts WHERE conversation_id=ANY($1::uuid[])`, [ids]);
    await client.query(`DELETE FROM ${schema}.instagram_messages WHERE conversation_id=ANY($1::uuid[])`, [ids]);
    await client.query(`DELETE FROM ${schema}.instagram_conversations WHERE id=ANY($1::uuid[])`, [ids]);
    // Scoped demo audit retains IDs to test replay; production needs its own minimization/retention design.
    await client.query(`INSERT INTO ${schema}.deletion_audit(request_id,account_id,subject_id,counts)
      VALUES($1,$2,$3,$4::jsonb)`, [requestId, accountId, subjectId, JSON.stringify(counts)]);
    await beforeCommit();
    await client.query("COMMIT");
    return { ...counts, replay: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

module.exports = { demoSchema, redactWebhook, deleteDemoConversation };
