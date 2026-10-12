const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Script } = require("node:vm");
const { randomUUID } = require("node:crypto");

async function main() {
  const env = require("../src/config/env");
  assert.ok(["localhost", "127.0.0.1"].includes(env.DB_HOST));
  assert.equal(Boolean(env.DB_CONNECTION_STRING), false);
  const { Pool } = require("pg");
  const config = { host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME,
    user: env.DB_USER, password: env.DB_PASSWORD };
  const admin = new Pool(config);
  const schema = "inbox_summary_test_" + randomUUID().replaceAll("-", "");
  const pool = new Pool({ ...config, options: `-c search_path=${schema},public` });
  const db = { query: (sql, params) => pool.query(sql, params), getPool: () => pool };
  const module = { exports: {} };
  const filename = path.resolve(__dirname, "../src/modules/conversations/instagram-conversations.service.js");
  new Script(`(function(require,module){${fs.readFileSync(filename, "utf8")}\n})`, { filename })
    .runInThisContext()((name) => {
      if (name === "./instagram-profile-cache") return { lookupProfile: async () => null };
      assert.equal(name, "../../lib/db"); return db;
    }, module);
  const service = module.exports;
  const account = randomUUID();
  const other = randomUUID();
  const conversation = randomUUID();
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE instagram_accounts (id uuid PRIMARY KEY, nome text);
      CREATE TABLE instagram_conversations (id uuid PRIMARY KEY, account_id uuid,
        instagram_user_id text, instagram_username text, instagram_name text,
        last_message_text text, last_message_at timestamptz, deleted_at timestamptz,
        created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW());
      CREATE TABLE instagram_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid, message_text text, payload jsonb,
        created_at timestamptz NOT NULL, inbox_unread boolean DEFAULT FALSE);
    `);
    await pool.query("INSERT INTO instagram_conversations(id,account_id,instagram_user_id,instagram_username,instagram_name,last_message_text) VALUES($1,$2,'123','ana',' Ana Silva ','Resumo antigo')", [conversation, account]);
    await pool.query("INSERT INTO instagram_conversations(id,account_id,instagram_user_id,last_message_text) VALUES($1,$2,'456','Outra conta')", [randomUUID(), other]);
    await pool.query("INSERT INTO instagram_conversations(id,account_id,deleted_at) VALUES($1,$2,NOW())", [randomUUID(), account]);
    const latest = async () => {
      const result = await service.listConversations({ accountId: account });
      assert.equal(result.total, 1, "Conta isolada e conversa excluida omitida");
      const item = result.items[0];
      assert.equal(item.instagramName, "Ana Silva");
      assert.equal(item.instagramUsername, "ana");
      assert.equal(Object.hasOwn(item, "_lastMessagePayload"), false);
      assert.ok(!JSON.stringify(item).includes("test-only"), "Nao expor payload/URL do anexo");
      return item;
    };
    assert.equal((await latest()).lastMessageText, "Resumo antigo");
    const add = (text, payload, time, unread = false, id = randomUUID()) => pool.query(
      "INSERT INTO instagram_messages(id,conversation_id,message_text,payload,created_at,inbox_unread) VALUES($1,$2,$3,$4::jsonb,$5,$6)",
      [id, conversation, text, JSON.stringify(payload), time, unread]);
    await add("Texto real", {}, "2026-10-12T10:00:00Z", true);
    await add(" ", { read: { watermark: 123 } }, "2026-10-12T10:01:00Z");
    let item = await latest();
    assert.equal(item.lastMessageText, "Texto real");
    assert.equal(new Date(item.lastMessageAt).toISOString(), "2026-10-12T10:00:00.000Z");
    assert.equal(item.unreadCount, 1);
    const attachment = type => ({ type, payload: { url: "https://example.test/image.png?test-only=cap" } });
    await add(null, { message: { attachments: [attachment("image")] } }, "2026-10-12T10:02:00Z", true);
    assert.equal((await latest()).lastMessageText, "[Imagem]");
    assert.equal((await latest()).unreadCount, 2);
    await add(null, { inboxImage: { filename: "test-only.jpg" } }, "2026-10-12T10:03:00Z");
    assert.equal((await latest()).lastMessageText, "[Imagem]");
    for (const [index, [type, expected]] of [
      ["video", "[Video]"], ["audio", "[Audio]"], ["file", "[Arquivo]"],
      ["unknown", "[Anexo]"], ["__proto__", "[Anexo]"],
    ].entries()) {
      await add(null, { attachments: [attachment(type)] }, `2026-10-12T10:${String(index + 4).padStart(2, "0")}:00Z`);
      assert.equal((await latest()).lastMessageText, expected);
    }
    await add(null, { attachments: [attachment("image"), attachment("image")] }, "2026-10-12T10:10:00Z");
    assert.equal((await latest()).lastMessageText, "[Anexos]");
    await add("Legenda com anexo", { attachments: [attachment("image")] }, "2026-10-12T10:11:00Z");
    assert.equal((await latest()).lastMessageText, "Legenda com anexo");
    for (const payload of [null, [], "invalid", { attachments: {} }, { attachments: [] }, { attachments: [null, {}, "invalid", { type: 123 }] }]) {
      await add(null, payload, "2026-10-12T10:12:00Z");
      assert.equal((await latest()).lastMessageText, "Legenda com anexo");
    }
    await add("Empate menor", {}, "2026-10-12T10:13:00Z", false, "00000000-0000-4000-8000-000000000001");
    await add("Empate maior", {}, "2026-10-12T10:13:00Z", false, "00000000-0000-4000-8000-000000000002");
    assert.equal((await latest()).lastMessageText, "Empate maior");
    await pool.query("ALTER TABLE instagram_messages RENAME payload TO raw_payload");
    await pool.query("ALTER TABLE instagram_conversations DROP COLUMN instagram_name");
    await pool.query("INSERT INTO instagram_messages(conversation_id,raw_payload,created_at) VALUES($1,$2::jsonb,$3)",
      [conversation, JSON.stringify({ attachments: [attachment("image")] }), "2026-10-12T10:15:00Z"]);
    const legacy = (await service.listConversations({ accountId: account })).items[0];
    assert.equal(legacy.instagramName, null);
    assert.equal(legacy.lastMessageText, "[Imagem]");
    console.log("Aprovados: nome salvo, texto/anexos/recibos, data real, contadores, payload invalido, desempate, escopo/deleted, sem payload exposto e schema legado. Schema isolado removido.");
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
