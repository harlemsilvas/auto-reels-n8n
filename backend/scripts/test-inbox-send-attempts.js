const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Script } = require("node:vm");
const { randomUUID } = require("node:crypto");

function load(file, dependencies) {
  const filename = path.resolve(__dirname, "../src", file);
  const module = { exports: {} };
  new Script(`(function(require,module){${fs.readFileSync(filename, "utf8")}\n})`, { filename })
    .runInThisContext()((name) => {
      if(name==="../privacy/scope-gate")return {outbound:async(_scope,_kind,callback)=>callback()};
      assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name];
    }, module);
  return module.exports;
}

async function main() {
  const env = require("../src/config/env");
  assert.ok(["localhost", "127.0.0.1"].includes(env.DB_HOST));
  assert.equal(Boolean(env.DB_CONNECTION_STRING), false);
  const { Pool } = require("pg");
  const config = { host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD };
  const admin = new Pool(config);
  const schema = "inbox_attempt_test_" + randomUUID().replaceAll("-", "");
  const pool = new Pool({ ...config, options: `-c search_path=${schema},public` });
  const db = { query: (sql, params) => pool.query(sql, params), getPool: () => pool };
  const repo = load("modules/webhooks/instagram-messages.repository.js", { "../../lib/db": db });
  const reloadLedger = () => load("modules/inbox/message-send-attempts.js", {
    "node:crypto": require("node:crypto"), "../../lib/db": db,
    "../webhooks/instagram-messages.repository": repo,
  });
  let ledger = reloadLedger();
  let apiCalls = 0;
  let outcome = "success";
  let release;
  let saveFails = false;
  const senderDependencies = {
    "../../lib/db": db, "../inbox/message-send-attempts": ledger,
    "../webhooks/instagram-messages.repository": { ...repo, saveMessage: async input => {
      if (saveFails) throw Error("Simulated persistence failure"); return repo.saveMessage(input);
    } },
    "./instagram-api.client": {
      sendTypingIndicator: async () => {},
      sendTextMessage: async () => {
        apiCalls++;
        if (outcome === "held") await new Promise(resolve => { release = resolve; });
        if (outcome === "uncertain") throw Object.assign(Error("Timeout"), { status: 502 });
        if (outcome === "rejected") throw Object.assign(Error("Rejected"), { status: 400 });
        return { message_id: `meta-${apiCalls}`, access_token: "discard-provider-extra" };
      },
    },
  };
  const sender = load("modules/instagram/instagram-send.service.js", senderDependencies);
  const accountId = randomUUID();
  const conversationId = randomUUID();
  const other = randomUUID();
  const input = { accountId, conversationId, recipientId: "123", messageText: "Original" };
  const migration = name => fs.readFileSync(path.resolve(__dirname, `../sql/${name}`), "utf8")
    .split("\n").filter(line => !line.startsWith("\\")).join("\n")
    .replaceAll("public.", schema + ".").replaceAll("'public'", `'${schema}'`);
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE instagram_accounts (id uuid PRIMARY KEY, instagram_id text, access_token text, nome text, deleted_at timestamptz);
      CREATE TABLE instagram_conversations (id uuid PRIMARY KEY, account_id uuid, instagram_user_id text,
        instagram_username text, last_message_at timestamptz, unread_count int DEFAULT 0,
        created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW(), deleted_at timestamptz);
      CREATE TABLE instagram_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid,
        sender_id text, recipient_id text, sender_type text, message_text text, meta_message_id text,
        payload jsonb, created_at timestamptz NOT NULL DEFAULT NOW(), inbox_unread boolean DEFAULT FALSE);
    `);
    const sql = migration("015-inbox-send-attempts.sql");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql.replace(/\bBEGIN;|\bCOMMIT;/g, ""));
      await client.query("ROLLBACK");
      assert.equal((await client.query("SELECT to_regclass($1) AS name", [`${schema}.instagram_send_attempts`])).rows[0].name, null);
    } finally { client.release(); }
    await pool.query(sql);
    await pool.query(sql);
    await pool.query(migration("015-inbox-send-attempts-verify.sql"));
    const invalidIndex = await pool.connect();
    try {
      await invalidIndex.query("BEGIN");
      await invalidIndex.query(`DROP INDEX ${schema}.idx_instagram_send_attempts_active`);
      await invalidIndex.query(`CREATE UNIQUE INDEX idx_instagram_send_attempts_active ON ${schema}.instagram_send_attempts(id) WHERE state IN ('sending','uncertain')`);
      await assert.rejects(invalidIndex.query(migration("015-inbox-send-attempts-verify.sql")));
      await invalidIndex.query("ROLLBACK");
    } finally { invalidIndex.release(); }
    await pool.query("INSERT INTO instagram_accounts(id,instagram_id,access_token) VALUES($1,'ig','fake-token')", [accountId]);
    await pool.query("INSERT INTO instagram_conversations(id,account_id,instagram_user_id) VALUES($1,$2,'123'),($3,$2,'456')", [conversationId, accountId, other]);
    const requestId = randomUUID();
    outcome = "held";
    const first = sender.sendTextMessage({ ...input, requestId });
    const deadline = Date.now() + 5000;
    while (!release) { assert.ok(Date.now() < deadline); await new Promise(resolve => setTimeout(resolve, 10)); }
    await assert.rejects(sender.sendTextMessage({ ...input, requestId }), { deliveryMayHaveSucceeded: true });
    await assert.rejects(sender.sendTextMessage({ ...input, requestId: randomUUID(), messageText: "Other device" }), { deliveryMayHaveSucceeded: true });
    assert.equal(apiCalls, 1);
    ledger = reloadLedger();
    assert.equal((await ledger.status(conversationId)).attempt.id, requestId, "State survives process/module reload");
    await assert.rejects(ledger.dismiss(conversationId, requestId, true), { status: 409 });
    await assert.rejects(ledger.dismiss(conversationId, requestId, false), { status: 400 });
    release();
    const saved = await first;
    outcome = "success";
    assert.equal((await sender.sendTextMessage({ ...input, requestId })).id, saved.id);
    assert.equal((await sender.sendTextMessage({ ...input, requestId: randomUUID() })).id, saved.id, "New ID/same text within window reuses success");
    assert.equal(apiCalls, 1);
    await assert.rejects(sender.sendTextMessage({ ...input, requestId, messageText: "Changed" }), { status: 409 });
    await assert.rejects(sender.sendTextMessage({ ...input, requestId, conversationId: other, recipientId: "456" }), { status: 409 });
    await assert.rejects(sender.sendTextMessage({ ...input, requestId: randomUUID(), recipientId: "spoofed" }), { status: 404 });
    await pool.query("UPDATE instagram_send_attempts SET sent_at=NOW()-INTERVAL '2 minutes' WHERE conversation_id=$1 AND state='sent'", [conversationId]);
    assert.equal((await sender.sendTextMessage({ ...input, requestId })).id, saved.id, "Stable request ID survives dedup window");
    assert.equal(apiCalls, 1);
    const repeated = await sender.sendTextMessage({ ...input, requestId: randomUUID() });
    assert.notEqual(repeated.id, saved.id, "Intentional new ID outside short window can repeat text");
    assert.equal(apiCalls, 2);
    const uncertainId = randomUUID();
    outcome = "uncertain";
    await assert.rejects(sender.sendTextMessage({ ...input, requestId: uncertainId, messageText: "Uncertain" }), { deliveryMayHaveSucceeded: true });
    const beforeRetry = apiCalls;
    await assert.rejects(sender.sendTextMessage({ ...input, requestId: randomUUID(), messageText: "New client retry" }), { deliveryMayHaveSucceeded: true });
    assert.equal(apiCalls, beforeRetry);
    await assert.rejects(ledger.reconcile(conversationId, uncertainId), { status: 409 });
    await ledger.dismiss(conversationId, uncertainId, true);
    assert.equal((await ledger.status(conversationId, uncertainId)).attempt.state, "dismissed");
    outcome = "rejected";
    const rejectedId = randomUUID();
    await assert.rejects(sender.sendTextMessage({ ...input, requestId: rejectedId, messageText: "Reject" }), { status: 400 });
    assert.equal((await ledger.status(conversationId, rejectedId)).attempt.state, "rejected");
    outcome = "success";
    saveFails = true;
    const repairId = randomUUID();
    await assert.rejects(sender.sendTextMessage({ ...input, requestId: repairId, messageText: "Repair locally" }), { deliveryMayHaveSucceeded: true });
    const repair = (await ledger.status(conversationId)).attempt;
    assert.ok(repair.metaMessageId);
    const stored = (await pool.query("SELECT response FROM instagram_send_attempts WHERE id=$1", [repairId])).rows[0].response;
    assert.deepEqual(Object.keys(stored), ["message_id"]);
    saveFails = false;
    const callsBeforeRepair = apiCalls;
    const repairs = await Promise.all([reloadLedger().reconcile(conversationId, repairId), reloadLedger().reconcile(conversationId, repairId)]);
    assert.equal(repairs[0].message.id, repairs[1].message.id);
    assert.equal(apiCalls, callsBeforeRepair);
    assert.equal((await ledger.status(conversationId, repairId)).attempt.state, "sent");
    assert.equal((await ledger.reconcile(conversationId, repairId)).message.id, repairs[0].message.id);
    await assert.rejects(ledger.dismiss(conversationId, repairId, true), { status: 409 });
    const ackId = randomUUID();
    const ackSender = load("modules/instagram/instagram-send.service.js", { ...senderDependencies,
      "../inbox/message-send-attempts": { ...ledger, finish: async (id, message) => {
        await ledger.finish(id, message); throw Error("Simulated lost commit acknowledgement");
      } },
    });
    await assert.rejects(ackSender.sendTextMessage({ ...input, requestId: ackId, messageText: "Lost HTTP result" }), { deliveryMayHaveSucceeded: true });
    assert.equal((await reloadLedger().status(conversationId, ackId)).attempt.state, "sent");
    const callsAfterAck = apiCalls;
    await sender.sendTextMessage({ ...input, requestId: ackId, messageText: "Lost HTTP result" });
    assert.equal(apiCalls, callsAfterAck);
    const metadataId = randomUUID();
    const metadataSender = load("modules/instagram/instagram-send.service.js", { ...senderDependencies,
      "../inbox/message-send-attempts": { ...ledger, recordDelivery: async () => { throw Error("Simulated metadata write failure"); } },
    });
    await assert.rejects(metadataSender.sendTextMessage({ ...input, requestId: metadataId, messageText: "Recover receipt" }), { deliveryMayHaveSucceeded: true });
    const beforeMetadataRepair = apiCalls;
    const metadataRepair = await reloadLedger().reconcile(conversationId, metadataId);
    assert.equal(metadataRepair.attempt.state, "sent");
    assert.equal(apiCalls, beforeMetadataRepair);
    await assert.rejects(ledger.status(conversationId, [requestId]), { status: 400 });
    const orphan = await ledger.claim({ ...input, requestId: randomUUID(), messageText: "Crash before response" });
    await pool.query("UPDATE instagram_send_attempts SET created_at=NOW()-INTERVAL '6 minutes' WHERE id=$1", [orphan.row.id]);
    await assert.rejects(pool.query(`INSERT INTO instagram_send_attempts(id,conversation_id,content_hash,message_text,recipient_id)
      VALUES($1,$2,$3,'Race','123')`, [randomUUID(), conversationId, "a".repeat(64)]), { code: "23505" });
    await ledger.dismiss(conversationId, orphan.row.id, true);

    const express = require("express");
    const permissions = require("../src/modules/auth/permissions.service");
    const auth = load("modules/auth/admin-auth.middleware.js", {
      "../../config/env": { ADMIN_AUTH_ENABLED: true, ADMIN_AUTH_COOKIE_NAME: "session" },
      "./permissions.service": permissions,
      "./admin-auth.service": { authenticateToken: async token => ["admin", "operator"].includes(token) ? { role: token } : null,
        validateCsrf: (_session, token) => token === "fake" },
    });
    const controller = load("modules/inbox/instagram-send-message.controller.js", { "./instagram-send-message.service": { sendMessage: params => sender.sendTextMessage(params) } });
    const routes = load("modules/inbox/instagram-send-message.routes.js", { express,
      "./instagram-send-message.controller": controller, "./message-send-attempts": ledger });
    const app = express();
    app.use(express.json(), auth.requireAdminSession);
    app.use((req, res, next) => req.method === "GET" ? next() : auth.requireCsrf(req, res, next));
    app.use(auth.requirePermission(permissions.PERMISSIONS.INBOX_REPLY), routes);
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: "Simulated failure" }));
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const url = `${base}/attempts/${conversationId}?requestId=${repairId}`;
      assert.equal((await fetch(url)).status, 401);
      assert.equal((await fetch(url, { headers: { Cookie: "session=operator" } })).status, 403);
      const result = await fetch(url, { headers: { Cookie: "session=admin" } });
      assert.equal(result.status, 200);
      assert.ok(!JSON.stringify(await result.json()).includes("fake-token"));
      assert.equal((await fetch(`${base}/attempts/${conversationId}/dismiss`, { method: "POST",
        headers: { Cookie: "session=admin", "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: repairId, acknowledged: true }) })).status, 403);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    console.log("Aprovados: migration rollback/idempotencia, concorrencia, IDs/reuso curto, escopo, restart, rejeicao/incerto, reparo local concorrente, descarte manual, indice ativo e sessao/CSRF/permissoes. PostgreSQL isolado; zero Meta real.");
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
