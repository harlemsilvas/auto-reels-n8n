const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Script } = require("node:vm");
const { randomUUID } = require("node:crypto");

function load(file, db) {
  const module = { exports: {} };
  const filename = path.resolve(__dirname, "../src", file);
  new Script(`(function(require,module){\n${fs.readFileSync(filename, "utf8")}\n})`, { filename })
    .runInThisContext()((name) => {
      if (name === "./instagram-profile-cache") return { lookupProfile: async () => null };
      assert.equal(name, "../../lib/db");
      return db;
    }, module);
  return module.exports;
}

async function main() {
  const env = require("../src/config/env");
  assert.ok(["localhost", "127.0.0.1"].includes(env.DB_HOST));
  assert.equal(Boolean(env.DB_CONNECTION_STRING), false);
  const { Pool } = require("pg");
  const config = { host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME,
    user: env.DB_USER, password: env.DB_PASSWORD };
  const admin = new Pool(config);
  const schema = "inbox_unread_test_" + randomUUID().replaceAll("-", "");
  const pool = new Pool({ ...config, options: `-c search_path=${schema},public` });
  const db = { getPool: () => pool, query: (sql, params) => pool.query(sql, params) };
  const repo = load("modules/webhooks/instagram-messages.repository.js", db);
  const service = load("modules/conversations/instagram-conversations.service.js", db);
  const id = randomUUID();
  const other = randomUUID();
  const migration = fs.readFileSync(path.resolve(__dirname, "../sql/014-inbox-unread.sql"), "utf8")
    .split("\n").filter((line) => !line.startsWith("\\")).join("\n").replaceAll("public.", schema + ".");
  const verify = fs.readFileSync(path.resolve(__dirname, "../sql/014-inbox-unread-verify.sql"), "utf8")
    .split("\n").filter((line) => !line.startsWith("\\")).join("\n").replaceAll("'public'", "'" + schema + "'");
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE instagram_conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL, instagram_user_id text,
        instagram_username text, last_message_text text, last_message_at timestamptz,
        unread_count integer DEFAULT 0, created_at timestamptz DEFAULT NOW(),
        updated_at timestamptz DEFAULT NOW(), deleted_at timestamptz
      );
      CREATE TABLE instagram_accounts (id uuid PRIMARY KEY, nome text);
      CREATE TABLE instagram_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid REFERENCES instagram_conversations(id),
        sender_id text, recipient_id text, sender_type text NOT NULL,
        message_text text, meta_message_id text, payload jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )`);
    await pool.query("INSERT INTO instagram_conversations(id,account_id,instagram_user_id) VALUES($1,$1,'test'),($2,$2,'other')", [id, other]);
    await pool.query("INSERT INTO instagram_messages(conversation_id,sender_type,message_text) VALUES($1,'user','Historical')", [id]);
    await pool.query(migration);
    await pool.query(migration);
    await pool.query(verify);
    const firstConversations = await Promise.all([
      repo.findOrCreateConversation({ accountId: id, instagramUserId: "new-tester" }),
      repo.findOrCreateConversation({ accountId: id, instagramUserId: "new-tester" }),
    ]);
    assert.equal(firstConversations[0].id, firstConversations[1].id);
    assert.equal((await pool.query("SELECT inbox_unread FROM instagram_messages")).rows[0].inbox_unread, false);
    async function count() {
      const rows = (await service.listConversations({})).items;
      return rows.find((item) => item.id === id).unreadCount;
    }
    const save = (mid, sentBy = "user", payload = { test: true }) => repo.saveMessage({ conversationId: id,
      senderId: "tester", recipientId: "account", messageText: mid, metaMessageId: mid,
      payload, sentBy });
    assert.equal(await count(), 0);
    const imagePayload = { message: { attachments: [{ type: "image", payload: { url: "https://example.test/image.png" } }] } };
    const first = await save("inbound1", "user", imagePayload);
    assert.deepEqual(first.payload, imagePayload, "Payload de imagem disponivel para SSE");
    assert.equal(await count(), 1);
    const duplicate = await save("inbound1");
    assert.equal(duplicate.wasDuplicate, true);
    assert.deepEqual(duplicate.payload, imagePayload);
    assert.equal(await count(), 1);
    await save("outbound", "bot");
    assert.equal(await count(), 1);
    const second = await save("inbound2");
    assert.equal(await count(), 2);
    assert.equal((await service.markConversationAsRead(id, [first.id])).unreadCount, 1);
    assert.equal((await service.markConversationAsRead(id, [first.id])).unreadCount, 1);
    assert.equal((await service.markConversationAsRead(id, [])).unreadCount, 1);
    assert.equal((await service.markConversationAsRead(other, [second.id])).unreadCount, 0);
    assert.equal(await count(), 1);
    await assert.rejects(service.markConversationAsRead(id, ["invalid"]), { status: 400 });
    await assert.rejects(service.markConversationAsRead(randomUUID(), []), { status: 404 });
    const duplicates = await Promise.all([save("concurrent"), save("concurrent")]);
    assert.equal(duplicates.filter((row) => row.wasDuplicate).length, 1);
    assert.equal(await count(), 2);
    await Promise.all([save("arrived-after-fetch"), service.markConversationAsRead(id, [second.id])]);
    assert.equal(await count(), 2);
    assert.equal((await service.markConversationAsRead(id)).unreadCount, 0);
    const faulty = load("modules/webhooks/instagram-messages.repository.js", {
      getPool: () => ({ connect: async () => {
        const client = await pool.connect();
        return { release: () => client.release(), query: (sql, params) => {
          if (sql.includes("UPDATE instagram_conversations")) throw Error("Counter failure");
          return client.query(sql, params);
        } };
      } }),
    });
    await assert.rejects(faulty.saveMessage({ conversationId: id, sentBy: "user",
      metaMessageId: "rollback", messageText: "Test", payload: {} }));
    assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM instagram_messages WHERE meta_message_id='rollback'")).rows[0].n, 0);
    assert.equal(await count(), 0);
    await pool.query("ALTER TABLE instagram_messages RENAME sender_type TO sent_by");
    await pool.query("ALTER TABLE instagram_messages RENAME payload TO raw_payload");
    const legacy = await save("legacy");
    assert.equal(legacy.sentBy, "user");
    assert.equal(await count(), 1);
    const listed = await service.listMessages({ conversationId: id, limit: 1 });
    assert.equal(listed.items[0].id, legacy.id);
    console.log("Aprovados: migration idempotente, historico preservado, inbound/outbound, duplicados concorrentes, leitura parcial/escopo/vazia, corrida leitura+nova DM, rollback e schema legado.");
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
