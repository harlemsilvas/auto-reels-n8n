const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Script } = require("node:vm");
const test = require("node:test");

function load(file, dependencies) {
  const module = { exports: {} };
  const filename = path.resolve(__dirname, "../src", file);
  new Script(`(function(require,module){\n${fs.readFileSync(filename, "utf8")}\n})`, { filename })
    .runInThisContext()((name) => {
      assert.ok(Object.hasOwn(dependencies, name), name);
      return dependencies[name];
    }, module);
  return module.exports;
}

function sendService({ token = "fake", account = true, typingFails = false, sendFails = false, saveFails = false } = {}) {
  const calls = [];
  const service = load("modules/instagram/instagram-send.service.js", {
    "../../lib/db": { query: async () => ({ rowCount: account ? 1 : 0, rows: [{ id: "a1", instagramId: "ig1", accessToken: token }] }) },
    "../webhooks/instagram-messages.repository": {
      findOrCreateConversation: async () => ({ id: "c1" }),
      saveMessage: async (message) => {
        calls.push(["save", message]);
        if (saveFails) throw Error("Persistence failed");
        return { id: "m1", ...message };
      },
    },
    "./instagram-api.client": {
      sendTypingIndicator: async () => { calls.push(["typing"]); if (typingFails) throw Error("Typing failed"); },
      sendTextMessage: async () => { calls.push(["send"]); if (sendFails) throw Error("Meta unavailable"); return { message_id: "meta1" }; },
    },
  });
  return { service, calls };
}

test("SSE desativa buffering por resposta e remove cliente ao desconectar", () => {
  const calls = [];
  const gateway = { registerClient: () => calls.push("register"), removeClient: () => calls.push("remove") };
  const controller = load("modules/realtime/realtime.controller.js", { "./realtime.gateway": gateway });
  const headers = {};
  let close;
  controller.inboxStream({ on: (event, callback) => { assert.equal(event, "close"); close = callback; } }, {
    setHeader: (key, value) => { headers[key] = value; },
    flushHeaders: () => calls.push("flush"),
    write: (chunk) => { assert.match(chunk, /event: connected/); },
  });
  close();
  assert.equal(headers["Content-Type"], "text/event-stream");
  assert.equal(headers["X-Accel-Buffering"], "no");
  assert.deepEqual(calls, ["register", "flush", "remove"]);
});

for (const typingFails of [false, true]) {
  test(`Texto persiste mesmo com typing falhando=${typingFails}`, async () => {
    const { service, calls } = sendService({ typingFails });
    const result = await service.sendTextMessage({ accountId: "a1", recipientId: "user1", messageText: "Test" });
    assert.deepEqual(calls.map(([name]) => name), ["typing", "send", "save"]);
    assert.equal(result.metaMessageId, "meta1");
    assert.equal(result.sentBy, "bot");
  });
}
for (const options of [{ account: false }, { token: "" }, { sendFails: true }]) {
  test(`Falha de envio nao persiste: ${JSON.stringify(options)}`, async () => {
    const { service, calls } = sendService(options);
    await assert.rejects(service.sendTextMessage({ accountId: "a1", recipientId: "user1", messageText: "Test" }));
    assert.equal(calls.some(([name]) => name === "save"), false);
  });
}
test("Falha de persistencia propaga sem repetir envio", async () => {
  const { service, calls } = sendService({ saveFails: true });
  await assert.rejects(service.sendTextMessage({ accountId: "a1", recipientId: "user1", messageText: "Test" }));
  assert.equal(calls.filter(([name]) => name === "send").length, 1);
});

test("Middleware HTTP: sessao, CSRF e permissoes admin/operator", async () => {
  const express = require("express");
  const permissions = require("../src/modules/auth/permissions.service");
  const middleware = load("modules/auth/admin-auth.middleware.js", {
    "../../config/env": { ADMIN_AUTH_ENABLED: true, ADMIN_AUTH_COOKIE_NAME: "test-session" },
    "./admin-auth.service": {
      authenticateToken: async (token) => ["admin", "operator"].includes(token) ? { role: token } : null,
      validateCsrf: (_session, token) => token === "fake-csrf",
    },
    "./permissions.service": permissions,
  });
  const app = express();
  let writes = 0;
  app.use(middleware.requireAdminSession);
  app.use((req, res, next) => req.method === "GET" ? next() : middleware.requireCsrf(req, res, next));
  const conversations = load("modules/conversations/instagram-conversations.routes.js", {
    express, "./instagram-conversations.service": {
      listConversations: async () => ({ items: [], total: 0 }),
      listMessages: async () => ({ items: [], total: 0 }),
      markConversationAsRead: async () => ({ ok: true }),
    },
  });
  const testers = load("modules/inbox/testers-dm.routes.js", {
    express, "./testers-dm.service": {
      listTesterConversations: async () => ({ items: [] }),
      sendDmToTester: async () => { writes++; return { ok: true }; },
      hideTesterConversation: async () => { writes++; return { ok: true }; },
    },
  });
  app.use("/conversations", middleware.requirePermission(permissions.PERMISSIONS.INBOX_VIEW), conversations);
  app.post("/send", middleware.requirePermission(permissions.PERMISSIONS.INBOX_REPLY), (_req, res) => { writes++; res.json({ ok: true }); });
  app.use("/testers", middleware.requirePermission(permissions.PERMISSIONS.INBOX_MANAGE_TESTERS), testers);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(url, method = "GET", role, csrf) {
    const headers = {};
    if (role) headers.Cookie = `test-session=${role}`;
    if (csrf) headers["X-CSRF-Token"] = csrf;
    const response = await fetch(base + url, { method, headers });
    await response.text();
    return response.status;
  }
  try {
    assert.equal(await request("/conversations"), 401);
    assert.equal(await request("/send", "POST", "admin"), 403);
    assert.equal(await request("/send", "POST", "admin", "wrong"), 403);
    assert.equal(await request("/conversations", "GET", "operator"), 200);
    assert.equal(await request("/conversations/c1/read", "POST", "operator", "fake-csrf"), 200);
    assert.equal(await request("/send", "POST", "operator", "fake-csrf"), 403);
    assert.equal(await request("/testers/conversations", "GET", "operator"), 403);
    assert.equal(await request("/testers/conversations/c1", "DELETE", "operator", "fake-csrf"), 403);
    assert.equal(writes, 0);
    assert.equal(await request("/send", "POST", "admin", "fake-csrf"), 200);
    assert.equal(await request("/testers/send", "POST", "admin", "fake-csrf"), 201);
    assert.equal(await request("/testers/conversations/c1", "DELETE", "admin", "fake-csrf"), 200);
    assert.equal(writes, 3);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
