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

function fixture({ accountExists = true, duplicate = false, failQuery = false } = {}) {
  const calls = { raw: [], queries: [], conversations: [], saved: [], emitted: [], errors: [], logs: [] };
  const repository = {
    async saveWebhookEvent(payload) {
      calls.raw.push(payload);
    },
    async findOrCreateConversation(params) {
      calls.conversations.push(params);
      return { id: "conversation-test" };
    },
    async saveMessage(params) {
      const message = { id: "message-test", ...params, wasDuplicate: duplicate };
      calls.saved.push(message);
      return message;
    },
  };
  const dependencies = {
    "./instagram-messages.repository": repository,
    "../../lib/db": {
      async query(sql, params) {
        assert.match(sql, /ativo = true/);
        assert.match(sql, /deleted_at IS NULL/);
        if (failQuery) throw new Error("sensitive-error-demo");
        calls.queries.push(params);
        const rows = accountExists && params[0] !== "unknown-account"
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
    log(...args) { calls.logs.push(args); },
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

test("Webhook repetido preserva evento bruto sem emitir mensagem duplicada", async () => {
  const { service, calls } = fixture({ duplicate: true });
  await service.processWebhook(body(event({ message: { mid: "duplicate-mid", text: "Teste" } })));
  assert.equal(calls.raw.length, 1);
  assert.equal(calls.saved.length, 1);
  assert.equal(calls.emitted.length, 0);
});

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
    assert.deepEqual(calls.raw[0].entry[0].messaging, payload.entry[0].messaging);
    assert.equal(calls.queries.length, 1);
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
  assert.equal(calls.queries.length, 2);
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
    sender: { id: "recipient-test" }, recipient: { id: "sender-test" },
    message: { mid: "echo-test", text: "Test reply", is_echo: true },
  })));
  assert.equal(calls.raw.length, 1);
  assert.equal(calls.queries.length, 1);
  assert.deepEqual(calls.queries[0], ["recipient-test"]);
  assert.equal(calls.saved.length, 0);
  assert.equal(calls.emitted.length, 0);
});

test("changes.messaging misto nao grava eventos externos", async () => {
  const { service, calls } = fixture();
  const good = event({ message: { mid: "change-allowed", text: "Demo" } });
  await service.processWebhook({ object: "instagram", entry: [{ changes: [{
    field: "messages", value: { messaging: [good,
      { ...good, recipient: { id: "unknown-account" } }], extra: "external-demo" },
  }] }] });
  assert.equal(calls.saved.length, 1);
  assert.equal(calls.saved[0].payload, good);
  assert.doesNotMatch(JSON.stringify(calls.raw), /unknown-account|external-demo/);
});

test("Formato changes preserva o envio de texto", async () => {
  const { service, calls } = fixture();
  await service.processWebhook({
    object: "instagram",
    entry: [{ changes: [{ field: "messages", value: event({
      message: { mid: "change-test", text: "Test change" },
    }) }] }],
  });
  assert.equal(calls.saved.length, 1);
  assert.equal(calls.saved[0].messageText, "Test change");
  assert.equal(calls.emitted.length, 1);
  assert.equal(calls.errors.length, 0);
});

test("Conta desconhecida nao persiste evento nem cria conversa", async () => {
  const { service, calls } = fixture({ accountExists: false });
  await service.processWebhook(body(event({ message: { mid: "unknown-test", text: "Test" } })));
  assert.equal(calls.raw.length, 0);
  assert.equal(calls.queries.length, 1);
  assert.equal(calls.conversations.length, 0);
  assert.equal(calls.saved.length, 0);
  assert.equal(calls.emitted.length, 0);
});

test("Lote misto remove contas externas, metadados e changes nao suportados", async () => {
  const { service, calls } = fixture();
  const good = event({ message: { mid: "allowed", text: "private-text-demo" } });
  const bad = { ...good, recipient: { id: "unknown-account" } };
  await service.processWebhook({ object: "instagram", secret: "private-top-demo", entry: [{
    id: "private-entry-demo", messaging: [bad, good],
    changes: [{ field: "comments", value: bad }, { field: "messages", value: {
      messaging: [bad, good], extra: "private-change-demo",
    } }],
  }] });
  assert.deepEqual(calls.raw, [{ object: "instagram", entry: [{ messaging: [good], changes: [
    { field: "messages", value: { messaging: [good] } },
  ] }] }]);
  assert.equal(calls.saved.length, 2);
  assert.doesNotMatch(JSON.stringify(calls.logs), /private-|sender-test|recipient-test|allowed/);
});

test("Payload invalido/outro produto nao e persistido", async () => {
  const { service, calls } = fixture();
  for (const payload of [null, {}, { object: "page", entry: [event({})] },
    { object: "instagram", entry: {} }, { object: "instagram", entry: [null, { messaging: {} }] }])
    await service.processWebhook(payload);
  assert.equal(calls.raw.length, 0);
  assert.equal(calls.saved.length, 0);
});

test("Falha na resolucao de conta nao persiste nem imprime erro sensivel", async () => {
  const { service, calls } = fixture({ failQuery: true });
  await service.processWebhook(body(event({ message: { text: "private-text-demo" } })));
  assert.equal(calls.raw.length, 0);
  assert.equal(calls.saved.length, 0);
  assert.equal(calls.errors.length, 1);
  assert.doesNotMatch(JSON.stringify([...calls.errors, ...calls.logs]), /sensitive-error-demo|private-text-demo/);
});
