const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { Script } = require("node:vm");
const test = require("node:test");

function load(relativePath, dependencies) {
  const filename = path.resolve(__dirname, relativePath);
  const source = readFileSync(filename, "utf8");
  const module = { exports: {} };
  new Script(`(function(require, module) {\n${source}\n})`, { filename })
    .runInThisContext()((name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Dependencia inesperada: ${name}`);
      return dependencies[name];
    }, module);
  return module.exports;
}

function service(rows, getUserProfile) {
  return load("../src/modules/inbox/testers-dm.service.js", {
    "../../lib/db": { query: async () => ({ rows }) },
    "../instagram/instagram-send.service": {},
    "../instagram/instagram-api.client": { getUserProfile },
  });
}

function conversation(overrides = {}) {
  return {
    id: "conversation-test", instagramUserId: "123456",
    instagramName: null, instagramUsername: null,
    lastMessageText: "Latest real message", lastMessageAt: "2026-10-10T17:20:00Z",
    _accessToken: "fake-token", ...overrides,
  };
}

test("Ocultacao valida UUID e preserva escopo da pagina", async () => {
  let calls = 0;
  const id = "11111111-1111-1111-1111-111111111111";
  const api = load("../src/modules/inbox/testers-dm.service.js", {
    "../../lib/db": { query: async (sql, params) => {
      calls += 1;
      assert.match(sql, /SET testers_hidden_at = COALESCE/);
      assert.doesNotMatch(sql, /SET deleted_at|DELETE FROM|instagram_messages/);
      assert.deepEqual(params, [id]);
      return { rowCount: 1, rows: [{ id }] };
    } },
    "../instagram/instagram-send.service": {},
    "../instagram/instagram-api.client": {},
  });
  for (const invalid of [null, "USER_TEST_123", "bad' OR true", {}]) {
    await assert.rejects(api.hideTesterConversation(invalid), { status: 400 });
  }
  assert.equal(calls, 0);
  assert.deepEqual(await api.hideTesterConversation(id), { ok: true, id });
});

test("Ocultacao inexistente retorna 404", async () => {
  const api = load("../src/modules/inbox/testers-dm.service.js", {
    "../../lib/db": { query: async () => ({ rowCount: 0, rows: [] }) },
    "../instagram/instagram-send.service": {},
    "../instagram/instagram-api.client": {},
  });
  await assert.rejects(api.hideTesterConversation("11111111-1111-1111-1111-111111111111"), { status: 404 });
});

test("Complementa perfil e preserva ultima mensagem sem expor token", async () => {
  const input = conversation();
  const api = service([input], async (params) => {
    assert.equal(params.instagramUserId, input.instagramUserId);
    assert.equal(params.accessToken, "fake-token");
    return { name: "Test Name", username: "tester" };
  });
  const result = await api.listTesterConversations();
  assert.equal(result.total, 1);
  assert.equal(result.items[0].instagramName, "Test Name");
  assert.equal(result.items[0].instagramUsername, "tester");
  assert.equal(result.items[0].lastMessageText, input.lastMessageText);
  assert.equal(result.items[0].lastMessageAt, input.lastMessageAt);
  assert.equal(JSON.stringify(result).includes("fake-token"), false);
  assert.equal(Object.hasOwn(result.items[0], "_accessToken"), false);
  assert.equal(input.instagramName, null);
});

test("Migration idempotente e ocultacao preservam Inbox e mensagens com ROLLBACK", {
  skip: !process.argv.includes("--database"),
}, async () => {
  const env = require("../src/config/env");
  assert.ok(["localhost", "127.0.0.1"].includes(env.DB_HOST));
  assert.equal(Boolean(env.DB_CONNECTION_STRING), false);
  const { Pool } = require("pg");
  const pool = new Pool({ host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME,
    user: env.DB_USER, password: env.DB_PASSWORD });
  const client = await pool.connect();
  const sql = readFileSync(path.resolve(__dirname, "../sql/013-testers-dm-visibility.sql"), "utf8")
    .split("\n").filter((line) => !line.startsWith("\\") && !["BEGIN;", "COMMIT;"].includes(line.trim())).join("\n");
  const verify = readFileSync(path.resolve(__dirname, "../sql/013-testers-dm-visibility-verify.sql"), "utf8")
    .split("\n").filter((line) => !line.startsWith("\\")).join("\n");
  try {
    const before = await client.query("SELECT id, deleted_at FROM instagram_conversations ORDER BY id");
    const messages = await client.query("SELECT COUNT(*)::int AS n FROM instagram_messages");
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(sql);
    await client.query(verify);
    const row = before.rows.find((item) => item.deleted_at === null);
    assert.ok(row, "Conversa local necessaria para teste transacional");
    const api = load("../src/modules/inbox/testers-dm.service.js", {
      "../../lib/db": { query: (statement, params) => client.query(statement, params) },
      "../instagram/instagram-send.service": {},
      "../instagram/instagram-api.client": { getUserProfile: async () => assert.fail("Meta inesperada") },
    });
    await api.hideTesterConversation(row.id);
    const first = await client.query("SELECT testers_hidden_at FROM instagram_conversations WHERE id=$1", [row.id]);
    await api.hideTesterConversation(row.id);
    assert.deepEqual((await client.query("SELECT testers_hidden_at FROM instagram_conversations WHERE id=$1", [row.id])).rows, first.rows);
    assert.equal((await api.listTesterConversations()).items.some((item) => item.id === row.id), false);
    assert.deepEqual((await client.query("SELECT id, deleted_at FROM instagram_conversations ORDER BY id")).rows, before.rows);
    assert.deepEqual((await client.query("SELECT COUNT(*)::int AS n FROM instagram_messages")).rows, messages.rows);
    await client.query("ROLLBACK");
    assert.deepEqual((await client.query("SELECT id, deleted_at FROM instagram_conversations ORDER BY id")).rows, before.rows);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});

test("Falha Meta nao impede listagem nem expoe credenciais", async () => {
  const api = service([conversation()], async () => { throw new Error("Unavailable"); });
  const { items } = await api.listTesterConversations();
  assert.equal(items.length, 1);
  assert.equal(items[0].instagramUsername, null);
  assert.equal(items[0].lastMessageText, "Latest real message");
  assert.equal(Object.hasOwn(items[0], "_accessToken"), false);
});

test("Sem token, ID ficticio ou perfil completo nao consulta Meta", async () => {
  const rows = [
    conversation({ _accessToken: "" }),
    conversation({ instagramUserId: "USER_TEST_123" }),
    conversation({ instagramName: "Stored Name", instagramUsername: "stored" }),
  ];
  const api = service(rows, async () => { assert.fail("Consulta Meta inesperada"); });
  const result = await api.listTesterConversations();
  assert.equal(result.total, 3);
  assert.equal(result.items[2].instagramName, "Stored Name");
  assert.equal(result.items[2].instagramUsername, "stored");
  for (const row of result.items) assert.equal(Object.hasOwn(row, "_accessToken"), false);
});

test("Nao inventa nome ausente nem substitui perfil armazenado", async () => {
  const api = service([conversation({ instagramUsername: "stored" })], async () => ({
    name: null, username: "other",
  }));
  const { items } = await api.listTesterConversations();
  assert.equal(items[0].instagramName, null);
  assert.equal(items[0].instagramUsername, "stored");
});

test("Busca de perfil usa GET autenticado com timeout e campos limitados", async () => {
  const api = load("../src/modules/instagram/instagram-api.client.js", {
    "axios": {
      async get(url, options) {
        assert.equal(url, "https://graph.facebook.com/v23.0/123456");
        assert.equal(options.headers.Authorization, "Bearer fake-token");
        assert.equal(options.params.fields, "name,username");
        assert.equal(options.timeout, 3000);
        return { data: { username: "tester", name: "Test Name", extra: "discard" } };
      },
    },
    "../../config/env": { META_GRAPH_API_VERSION: "v23.0" },
  });
  assert.deepEqual(await api.getUserProfile({
    accessToken: "fake-token", instagramUserId: "123456",
  }), { name: "Test Name", username: "tester" });
});

test("Consulta PostgreSQL escolhe ultima mensagem real, nao recibo vazio", {
  skip: !process.argv.includes("--database"),
}, async () => {
  const env = require("../src/config/env");
  assert.ok(["localhost", "127.0.0.1"].includes(env.DB_HOST));
  assert.equal(Boolean(env.DB_CONNECTION_STRING), false);
  const db = require("../src/lib/db");
  const fixtures = `
    WITH instagram_conversations AS (
      SELECT 'conversation-test'::text AS id, 'account-test'::text AS account_id,
        '123456'::text AS instagram_user_id, NULL::text AS instagram_username,
        NULL::text AS instagram_name, NULL::text AS last_message_text,
        TIMESTAMPTZ '2026-10-10 10:00:00+00' AS last_message_at,
        0 AS unread_count, NOW() AS updated_at, NULL::timestamptz AS deleted_at
        , NULL::timestamptz AS testers_hidden_at
    ), instagram_accounts AS (
      SELECT 'account-test'::text AS id, NULL::text AS access_token,
        TRUE AS ativo, NULL::timestamptz AS deleted_at
    ), instagram_messages AS (
      SELECT * FROM (VALUES
        ('m1', 'conversation-test', 'Received text', TIMESTAMPTZ '2026-10-10 11:00:00+00'),
        ('m2', 'conversation-test', 'Sent reply', TIMESTAMPTZ '2026-10-10 12:00:00+00'),
        ('m3', 'conversation-test', NULL, TIMESTAMPTZ '2026-10-10 13:00:00+00'),
        ('m4', 'conversation-test', '  ', TIMESTAMPTZ '2026-10-10 14:00:00+00')
      ) AS m(id, conversation_id, message_text, created_at)
    )
  `;
  const api = load("../src/modules/inbox/testers-dm.service.js", {
    "../../lib/db": {
      query: async (sql) => {
        assert.match(sql.trim(), /^SELECT\s/);
        return db.query(fixtures + sql);
      },
    },
    "../instagram/instagram-send.service": {},
    "../instagram/instagram-api.client": {
      getUserProfile: async () => { assert.fail("Consulta Meta inesperada"); },
    },
  });
  try {
    const { items } = await api.listTesterConversations();
    assert.equal(items.length, 1);
    assert.equal(items[0].lastMessageText, "Sent reply");
    assert.equal(items[0].lastMessageAt.toISOString(), "2026-10-10T12:00:00.000Z");
    assert.equal(Object.hasOwn(items[0], "_accessToken"), false);
  } finally {
    await db.getPool().end();
  }
});
