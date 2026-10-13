const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { Script } = require("node:vm");
const test = require("node:test");
const sharp = require("sharp");

function load(file, dependencies) {
  const filename = path.resolve(__dirname, "../src", file);
  const module = { exports: {} };
  new Script(`(function(require,module){${readFileSync(filename, "utf8")}\n})`, { filename })
    .runInThisContext()((name) => {
      assert.ok(Object.hasOwn(dependencies, name), name);
      return dependencies[name];
    }, module);
  return module.exports;
}

const conversationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const messageId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("Revoga capacidade somente para o escopo confirmado e preserva outros destinatarios", async () => {
  let recipient="subject-a";
  const urls=[];
  const service=load("modules/inbox/inbox-images.service.js",{
    "node:fs/promises":{async mkdir(){},async writeFile(){}},"node:path":path,"node:crypto":crypto,sharp,
    "../../lib/db":{async query(){return {rowCount:1,rows:[{accountId:"account-a",recipientId:recipient}]};}},
    "../../config/env":{INBOX_MEDIA_DIR:"/tmp/demo-inbox",INBOX_PUBLIC_BASE_URL:"https://example.test"},
    "../instagram/instagram-send.service":{async sendImageMessage(input){urls.push(input.imageUrl);return {};}}
  });
  const buffer=await sharp({create:{width:2,height:2,channels:3,background:"red"}}).png().toBuffer();
  await service.sendConversationImage(conversationId,{buffer,mimetype:"image/png"});
  recipient="subject-b";
  await service.sendConversationImage(conversationId,{buffer,mimetype:"image/png"});
  const [a,b]=urls.map(url=>url.split("/").at(-1));
  assert.ok(service.resolveDelivery(a));
  assert.deepEqual(service.revokeScope({accountId:"account-a",instagramUserId:"subject-a"}),{removed:1,legacyUnscoped:0});
  assert.throws(()=>service.resolveDelivery(a),error=>error.status===404);
  assert.ok(service.resolveDelivery(b));
});

test("JPG/PNG: pixels validados, metadados removidos, formato e limites", async () => {
  const service = load("modules/inbox/inbox-images.service.js", {
    "node:fs/promises": fs, "node:path": path, "node:crypto": crypto, sharp,
    "../../lib/db": {}, "../../config/env": {}, "../instagram/instagram-send.service": {},
  });
  for (const format of ["jpeg", "png"]) {
    const buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } })
      .toFormat(format).withMetadata().toBuffer();
    const image = await service.normalizeImage({ buffer, mimetype: format === "jpeg" ? "image/jpeg" : "image/png" });
    const metadata = await sharp(image.buffer).metadata();
    assert.equal(metadata.format, format);
    assert.equal(metadata.exif, undefined);
  }
  for (const file of [undefined, { buffer: Buffer.from("<svg/>"), mimetype: "image/png" },
    { buffer: Buffer.from("x"), mimetype: "text/html" },
    { buffer: Buffer.alloc(service.MAX_IMAGE_BYTES + 1), mimetype: "image/png" }]) {
    await assert.rejects(service.normalizeImage(file), (error) => [400, 413].includes(error.status));
  }
  const huge = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "red" } }).png().toBuffer();
  await assert.rejects(service.normalizeImage({ buffer: huge, mimetype: "image/png" }), { status: 400 });
});

test("Rotas reais: multipart, sessao/CSRF/permissao, acesso privado e limpeza em falha", async () => {
  const express = require("express");
  const permissions = require("../src/modules/auth/permissions.service");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "inbox-images-"));
  let outcome = "success";
  let sends = 0;
  let deliveredUrl;
  let stored;
  const service = load("modules/inbox/inbox-images.service.js", {
    "node:fs/promises": fs, "node:path": path, "node:crypto": crypto, sharp,
    "../../config/env": { INBOX_MEDIA_DIR: directory, INBOX_PUBLIC_BASE_URL: "https://api.example.test" },
    "../../lib/db": { query: async (_sql, params) => params[0] === messageId
      ? { rows: params[1] === conversationId ? [{ payload: { inboxImage: stored } }] : [] }
      : { rowCount: params[0] === conversationId ? 1 : 0, rows: [{ accountId: "trusted-account", recipientId: "trusted-recipient" }] } },
    "../instagram/instagram-send.service": { sendImageMessage: async (input) => {
      sends++;
      assert.equal(input.accountId, "trusted-account");
      assert.equal(input.conversationId, conversationId);
      deliveredUrl = input.imageUrl;
      stored = input.imageMetadata;
      const token = new URL(deliveredUrl).pathname.split("/").at(-1);
      assert.ok((await fs.stat(service.resolveDelivery(token))).size > 0);
      if (outcome !== "success") throw Object.assign(Error("Simulated failure"), { status: 400, deliveryMayHaveSucceeded: outcome === "uncertain" });
      return { id: messageId, conversationId, sentBy: "bot", payload: { inboxImage: stored } };
    } },
  });
  const routes = load("modules/inbox/inbox-images.routes.js", {
    express, multer: require("multer"), "./inbox-images.service": service,
  });
  const middleware = load("modules/auth/admin-auth.middleware.js", {
    "../../config/env": { ADMIN_AUTH_ENABLED: true, ADMIN_AUTH_COOKIE_NAME: "session" },
    "./permissions.service": permissions,
    "./admin-auth.service": { authenticateToken: async (role) => ["admin", "operator"].includes(role) ? { role } : null,
      validateCsrf: (_auth, csrf) => csrf === "fake" },
  });
  const app = express();
  app.get("/delivery/:token", routes.serveDeliveryImage);
  app.use(middleware.requireAdminSession);
  app.use((req, res, next) => req.method === "GET" ? next() : middleware.requireCsrf(req, res, next));
  app.get("/conversations/:conversationId/messages/:messageId/image", middleware.requirePermission(permissions.PERMISSIONS.INBOX_VIEW), routes.serveConversationImage);
  app.use("/conversations", middleware.requirePermission(permissions.PERMISSIONS.INBOX_REPLY), routes.imageSendRoutes);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } }).png().toBuffer();
  async function send({ role = "admin", csrf = "fake", field = "image", image = buffer, fields = false, id = conversationId } = {}) {
    const form = new FormData();
    form.append(field, new Blob([image], { type: "image/png" }), "foto.png");
    if (fields) form.append("accountId", "spoofed");
    return fetch(`${base}/conversations/${id}/images`, { method: "POST", body: form,
      headers: { Cookie: `session=${role}`, "X-CSRF-Token": csrf } });
  }
  async function get(url, role) {
    const response = await fetch(base + url, { headers: role ? { Cookie: `session=${role}` } : {} });
    await response.arrayBuffer();
    return response.status;
  }
  try {
    assert.equal((await send({ role: "" })).status, 401);
    assert.equal((await send({ csrf: "wrong" })).status, 403);
    assert.equal((await send({ role: "operator" })).status, 403);
    assert.equal(sends, 0);
    assert.equal((await send({ field: "file" })).status, 400);
    assert.equal((await send({ fields: true })).status, 400);
    assert.equal((await send({ image: Buffer.from("invalid") })).status, 400);
    assert.equal((await send({ image: Buffer.alloc(service.MAX_IMAGE_BYTES + 1) })).status, 413);
    assert.equal((await send({ id: "not-a-uuid" })).status, 400);
    assert.equal((await send({ id: crypto.randomUUID() })).status, 404);
    const response = await send();
    assert.equal(response.status, 201);
    assert.ok((await response.json()).payload.inboxImage.filename);
    const file = (await fs.readdir(directory))[0];
    assert.equal((await fs.stat(path.join(directory, file))).mode & 0o777, 0o600);
    const token = new URL(deliveredUrl).pathname.split("/").at(-1);
    assert.equal(await get(`/delivery/${token}`), 200);
    assert.equal(await get(`/delivery/${"0".repeat(64)}`), 404);
    const now = Date.now;
    try {
      Date.now = () => now() + 16 * 60 * 1000;
      assert.throws(() => service.resolveDelivery(token), { status: 404 });
    } finally { Date.now = now; }
    assert.equal(await get(`/conversations/${conversationId}/messages/${messageId}/image`), 401);
    assert.equal(await get(`/conversations/${conversationId}/messages/${messageId}/image`, "operator"), 200);
    assert.equal(await get(`/conversations/${crypto.randomUUID()}/messages/${messageId}/image`, "admin"), 404);
    outcome = "rejected";
    assert.equal((await send()).status, 400);
    assert.equal((await fs.readdir(directory)).length, 1);
    outcome = "uncertain";
    const uncertain = await send();
    assert.equal(uncertain.status, 502);
    assert.equal((await uncertain.json()).code, "MESSAGE_DELIVERY_UNCERTAIN");
    assert.equal((await fs.readdir(directory)).length, 2);
    assert.equal(sends, 3, "Sem retry automatico");
    await assert.rejects(service.resolveConversationImage(conversationId, "bad"), { status: 400 });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("Servico Instagram persiste imagem e sinaliza resultado incerto sem retry", async () => {
  for (const outcome of ["success", "persist-failure", "meta-failure", "no-token"]) {
    let sends = 0;
    let saves = 0;
    const service = load("modules/instagram/instagram-send.service.js", {
      "../inbox/message-send-attempts": {},
      "../../lib/db": { query: async () => ({ rowCount: 1, rows: [{ accessToken: outcome === "no-token" ? "" : "fake", instagramId: "ig" }] }) },
      "../webhooks/instagram-messages.repository": { saveMessage: async (message) => {
        saves++;
        assert.equal(message.sentBy, "bot");
        assert.equal(message.conversationId, conversationId);
        assert.equal(message.payload.inboxImage.filename, "foto.jpg");
        if (outcome === "persist-failure") throw Error("Database unavailable");
        return { id: messageId, ...message };
      } },
      "./instagram-api.client": { sendImageMessage: async () => {
        sends++;
        if (outcome === "meta-failure") throw Object.assign(Error("Rejected"), { status: 400 });
        return { message_id: "meta-image" };
      } },
    });
    const input = { conversationId, accountId: "account", recipientId: "recipient", imageUrl: "https://example.test/photo.jpg", imageMetadata: { filename: "foto.jpg" } };
    if (outcome === "success") {
      const result = await service.sendImageMessage(input);
      assert.equal(result.payload.inboxImage.filename, "foto.jpg");
    } else {
      await assert.rejects(service.sendImageMessage(input), (error) => outcome === "no-token" || error.deliveryMayHaveSucceeded === (outcome === "persist-failure"));
    }
    assert.equal(sends, outcome === "no-token" ? 0 : 1);
    assert.equal(saves, ["success", "persist-failure"].includes(outcome) ? 1 : 0);
  }
});

test("Cliente Meta mantem Facebook Login e envia attachment image/url com timeout", async () => {
  const client = load("modules/instagram/instagram-api.client.js", {
    "../../config/env": { META_GRAPH_API_VERSION: "v23.0" },
    axios: { post: async (url, payload, options) => {
      assert.equal(url, "https://graph.facebook.com/v23.0/me/messages");
      assert.equal(payload.message.attachment.type, "image");
      assert.equal(payload.message.attachment.payload.url, "https://api.example.test/temporary");
      assert.equal(payload.recipient.id, "recipient");
      assert.equal(options.timeout, 30000);
      assert.equal(options.params.access_token, "fake");
      return { data: { message_id: "meta-image" } };
    } },
  });
  assert.deepEqual(await client.sendImageMessage({ accessToken: "fake", recipientId: "recipient", imageUrl: "https://api.example.test/temporary" }), { message_id: "meta-image" });
});
