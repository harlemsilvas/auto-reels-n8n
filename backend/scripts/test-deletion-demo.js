const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { demoSchema, redactWebhook, deleteDemoConversation } = require("../src/modules/privacy/deletion-demo");

async function main() {
  process.chdir(path.resolve(__dirname, ".."));
  process.env.DOTENV_CONFIG_QUIET = "true";
  const env = require("../src/config/env");
  assert.ok(["localhost", "127.0.0.1"].includes(env.DB_HOST));
  assert.ok(!env.DB_CONNECTION_STRING && process.env.NODE_ENV !== "production");
  const { getPool } = require("../src/lib/db");
  const pool = getPool();
  const schema = "mr05_deletion_demo_" + randomUUID().replaceAll("-", "");
  demoSchema(schema);
  const accountId = randomUUID(), conversationId = randomUUID(), other = randomUUID();
  const messageId = randomUUID(), attemptId = randomUUID(), requestId = randomUUID();
  const subjectId = "demo-subject";
  const input = { schema, accountId, subjectId, requestId, verified: true };
  const event = (sender, recipient) => ({ sender: { id: sender }, recipient: { id: recipient },
    message: { text: "demo-only", mid: "demo-meta" } });
  const targetEvent = event(subjectId, "demo-account");
  const outsideEvent = event("demo-other", "demo-account");
  const payload = { object: "instagram", entry: [{ messaging: [targetEvent, outsideEvent] },
    { changes: [{ field: "messages", value: { messaging: [targetEvent, outsideEvent] } }] }] };
  const publicState = async () => (await pool.query(`SELECT
    (SELECT count(*)::int FROM public.instagram_messages) AS messages,
    (SELECT count(*)::int FROM public.instagram_conversations) AS conversations,
    (SELECT count(*)::int FROM public.instagram_send_attempts) AS attempts,
    (SELECT count(*)::int FROM public.webhook_events) AS webhooks`)).rows[0];
  let created = false;
  try {
    const before = await publicState();
    assert.throws(() => demoSchema("public"), /DEMO_SCHEMA_REQUIRED/);
    assert.throws(() => redactWebhook({ entry: [{ changes: [{ field: "unknown", value: { id: subjectId } }] }] },
      "demo-account", subjectId), /WEBHOOK_SCOPE_AMBIGUOUS/);
    const differentAccount = { entry: [{ messaging: [event(subjectId, "other-account")] }] };
    assert.deepEqual(redactWebhook(differentAccount, "demo-account", subjectId).body, differentAccount);
    await pool.query(`CREATE SCHEMA ${schema}`);
    created = true;
    await pool.query(`CREATE TABLE ${schema}.instagram_accounts(id uuid PRIMARY KEY, instagram_id text);
      CREATE TABLE ${schema}.instagram_conversations(id uuid PRIMARY KEY, account_id uuid REFERENCES ${schema}.instagram_accounts,
        instagram_user_id text, last_message_text text);
      CREATE TABLE ${schema}.instagram_messages(id uuid PRIMARY KEY,
        conversation_id uuid REFERENCES ${schema}.instagram_conversations, meta_message_id text, payload jsonb);
      CREATE TABLE ${schema}.instagram_send_attempts(id uuid PRIMARY KEY,
        conversation_id uuid REFERENCES ${schema}.instagram_conversations, state text, meta_message_id text,
        message_id uuid REFERENCES ${schema}.instagram_messages ON DELETE SET NULL);
      CREATE TABLE ${schema}.webhook_events(id uuid PRIMARY KEY, payload jsonb);
      CREATE TABLE ${schema}.product_media(filename text);
      CREATE TABLE ${schema}.deletion_audit(request_id uuid PRIMARY KEY,account_id uuid,subject_id text,counts jsonb)`);
    await pool.query(`INSERT INTO ${schema}.instagram_accounts VALUES($1,'demo-account')`, [accountId]);
    await pool.query(`INSERT INTO ${schema}.instagram_conversations VALUES($1,$3,$4,'demo-summary'),($2,$3,'demo-other','other-summary')`,
      [conversationId, other, accountId, subjectId]);
    await pool.query(`INSERT INTO ${schema}.instagram_messages VALUES($1,$2,'demo-meta',$3)`,
      [messageId, conversationId, JSON.stringify({ inboxImage: { filename: "shared-demo.jpg" } })]);
    await pool.query(`INSERT INTO ${schema}.product_media VALUES('shared-demo.jpg')`);
    await pool.query(`INSERT INTO ${schema}.instagram_send_attempts VALUES($1,$2,'uncertain',NULL,NULL)`, [attemptId, conversationId]);
    const webhookId = randomUUID();
    await pool.query(`INSERT INTO ${schema}.webhook_events VALUES($1,$2)`, [webhookId, JSON.stringify(payload)]);
    await assert.rejects(deleteDemoConversation(pool, { ...input, verified: false }), /VERIFIED_DEMO_REQUEST_REQUIRED/);
    for (const state of ["uncertain", "sending", "unknown"]) {
      await pool.query(`UPDATE ${schema}.instagram_send_attempts SET state=$1`, [state]);
      await assert.rejects(deleteDemoConversation(pool, input), /DELIVERY_REQUIRES_REVIEW/);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${schema}.instagram_messages`)).rows[0].n, 1);
    }
    await pool.query(`UPDATE ${schema}.instagram_send_attempts SET state='sent',meta_message_id='demo-meta',message_id=$1`, [messageId]);
    await assert.rejects(deleteDemoConversation(pool, { ...input, beforeCommit: async () => { throw Error("DEMO_LATE_FAILURE"); } }), /DEMO_LATE_FAILURE/);
    assert.deepEqual((await pool.query(`SELECT payload FROM ${schema}.webhook_events`)).rows[0].payload, payload);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${schema}.instagram_messages`)).rows[0].n, 1);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${schema}.deletion_audit`)).rows[0].n, 0);
    const crossAttempt = randomUUID();
    await pool.query(`INSERT INTO ${schema}.instagram_send_attempts VALUES($1,$2,'sent','demo-meta',$3)`,
      [crossAttempt, other, messageId]);
    await assert.rejects(deleteDemoConversation(pool, input), /CROSS_CONVERSATION_REFERENCE/);
    await pool.query(`DELETE FROM ${schema}.instagram_send_attempts WHERE id=$1`, [crossAttempt]);
    // An unknown external FK aborts the transaction and restores event redaction too.
    await pool.query(`CREATE TABLE ${schema}.external_reference(id uuid REFERENCES ${schema}.instagram_messages);
      INSERT INTO ${schema}.external_reference VALUES('${messageId}')`);
    await assert.rejects(deleteDemoConversation(pool, input), error => error.code === "23503");
    assert.deepEqual((await pool.query(`SELECT payload FROM ${schema}.webhook_events`)).rows[0].payload, payload);
    await pool.query(`DROP TABLE ${schema}.external_reference`);
    const result = await deleteDemoConversation(pool, input);
    assert.equal(result.messages, 1);
    assert.equal(result.attempts, 1);
    assert.equal(result.webhookItemsRemoved, 2);
    assert.equal(result.sharedFilesPreserved, 1);
    assert.equal(result.privateFilesRequireSeparateCleanup, 0);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${schema}.instagram_conversations WHERE id=$1`, [other])).rows[0].n, 1);
    assert.deepEqual((await pool.query(`SELECT payload FROM ${schema}.webhook_events`)).rows[0].payload,
      { object: "instagram", entry: [{ messaging: [outsideEvent] }, { changes: [{ field: "messages", value: { messaging: [outsideEvent] } }] }] });
    const replay = await deleteDemoConversation(pool, input);
    assert.equal(replay.replay, true);
    await assert.rejects(deleteDemoConversation(pool, { ...input, subjectId: "different" }), /REQUEST_SCOPE_CONFLICT/);
    assert.deepEqual(await publicState(), before);
    console.log("Approved: demo schema guard, verified scope, sending/uncertain/unknown protection, transactional rollback, unknown FK rollback, mixed-account webhook redaction, shared media manifest, scoped deletion and request replay. Public counts unchanged.");
  } finally {
    if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  }
}
main().catch(() => { console.error("DELETION_DEMO_TEST_FAILED: inspect local test environment; no public cleanup requested."); process.exitCode = 1; });
