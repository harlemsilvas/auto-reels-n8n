const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { Script } = require("node:vm");
const test = require("node:test");

const filename = path.resolve(
  __dirname,
  "../src/modules/webhooks/instagram-messages.service.js",
);
const source = readFileSync(filename, "utf8");

function fixture({ accountExists = true } = {}) {
  const calls = { raw: [], queries: [], conversations: [], saved: [], emitted: [], errors: [] };
  const repository = {
    async saveWebhookEvent(payload) {
      calls.raw.push(payload);
    },
    async findOrCreateConversation(params) {
      calls.conversations.push(params);
      return { id: "conversation-test" };
    },
    async saveMessage(params) {
      const message = { id: "message-test", ...params };
      calls.saved.push(message);
      return message;
    },
  };
  const dependencies = {
    "./instagram-messages.repository": repository,
    "../../lib/db": {
      async query(sql, params) {
        calls.queries.push(params);
        const rows = accountExists
          ? [{ id: "account-test", instagramId: "recipient-test" }]
          : [];
        return { rowCount: rows.length, rows };
      },
    },
    "../realtime/realtime.events": {
      emitNewMessage(message) {
        calls.emitted.push(message);
      },
    },
  };
  const module = { exports: {} };
  // Todas as dependencias sao simuladas: nenhum banco ou cliente Meta e carregado.
  const load = new Script(`(function(require, module, console) {\n${source}\n})`, {
    filename,
  }).runInThisContext();
  load((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Dependencia inesperada: ${name}`);
    return dependencies[name];
  }, module, {
    log() {},
    error(...args) { calls.errors.push(args); },
  });
  return { service: module.exports, calls };
}

function event(extra) {
  return { sender: { id: "sender-test" }, recipient: { id: "recipient-test" }, ...extra };
}

function body(...events) {
  return { object: "instagram", entry: [{ messaging: events }] };
}

for (const [label, extra] of [
  ["read", { read: { watermark: 123 } }],
  ["delivery", { delivery: { mids: ["meta-test"] } }],
  ["reaction", { reaction: { mid: "meta-test", action: "react" } }],
  ["postback", { postback: { payload: "test" } }],
  ["message invalida", { message: "invalid" }],
]) {
  test(`Preserva webhook ${label} sem criar mensagem ou emitir evento`, async () => {
    const { service, calls } = fixture();
    const payload = body(event(extra));
    await service.processWebhook(payload);
    assert.equal(calls.raw[0], payload);
    assert.equal(calls.queries.length, 0);
    assert.equal(calls.conversations.length, 0);
    assert.equal(calls.saved.length, 0);
    assert.equal(calls.emitted.length, 0);
    assert.equal(calls.errors.length, 0);
  });
}

test("Recibo seguido de texto nao interrompe o lote", async () => {
  const { service, calls } = fixture();
  const message = event({ message: { mid: "meta-test", text: "Test message" } });
  await service.processWebhook(body(event({ read: {} }), message));
  assert.equal(calls.queries.length, 1);
  assert.equal(calls.queries[0][0], "recipient-test");
  assert.equal(calls.saved.length, 1);
  assert.equal(calls.saved[0].metaMessageId, "meta-test");
  assert.equal(calls.saved[0].messageText, "Test message");
  assert.equal(calls.saved[0].sentBy, "user");
  assert.equal(calls.saved[0].payload, message);
  assert.equal(calls.emitted[0], calls.saved[0]);
  assert.equal(calls.errors.length, 0);
});

test("Mensagem com anexo continua persistida e emitida", async () => {
  const { service, calls } = fixture();
  await service.processWebhook(body(event({
    message: { mid: "attachment-test", attachments: [{ type: "image" }] },
  })));
  assert.equal(calls.saved.length, 1);
  assert.equal(calls.saved[0].messageText, "[attachment]");
  assert.equal(calls.emitted.length, 1);
  assert.equal(calls.errors.length, 0);
});

test("Echo nao duplica mensagem enviada", async () => {
  const { service, calls } = fixture();
  await service.processWebhook(body(event({
    message: { mid: "echo-test", text: "Test reply", is_echo: true },
  })));
  assert.equal(calls.raw.length, 1);
  assert.equal(calls.queries.length, 0);
  assert.equal(calls.saved.length, 0);
  assert.equal(calls.emitted.length, 0);
});

test("Formato changes preserva o envio de texto", async () => {
  const { service, calls } = fixture();
  await service.processWebhook({
    entry: [{ changes: [{ field: "messages", value: event({
      message: { mid: "change-test", text: "Test change" },
    }) }] }],
  });
  assert.equal(calls.saved.length, 1);
  assert.equal(calls.saved[0].messageText, "Test change");
  assert.equal(calls.emitted.length, 1);
  assert.equal(calls.errors.length, 0);
});

test("Conta desconhecida nao cria conversa", async () => {
  const { service, calls } = fixture({ accountExists: false });
  await service.processWebhook(body(event({ message: { mid: "unknown-test", text: "Test" } })));
  assert.equal(calls.raw.length, 1);
  assert.equal(calls.queries.length, 1);
  assert.equal(calls.conversations.length, 0);
  assert.equal(calls.saved.length, 0);
  assert.equal(calls.emitted.length, 0);
});
