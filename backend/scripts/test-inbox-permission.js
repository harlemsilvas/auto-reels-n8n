const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load(relative, dependencies, consoleMock = { log() {}, error() {} }) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, relative), "utf8");
  vm.runInNewContext("(function(require,module,process,console){" + source + "\n})")(
    name => dependencies(name), module, { env: { NODE_ENV: "production" } }, consoleMock,
  );
  return module.exports;
}

async function main() {
  const logs = [];
  let status = 400;
  let calls = 0;
  const client = load("../src/modules/instagram/instagram-api.client.js", name => {
    if (name === "axios") return { post: async () => {
      calls++;
      throw { response: { status, data: { error: { code: 200, message: "PRIVATE_PROVIDER_TOKEN_AND_DM" } } } };
    } };
    if (name === "../../config/env") return { META_GRAPH_API_VERSION: "v25.0" };
    throw Error("Unexpected dependency: " + name);
  }, { log: (...args) => logs.push(args), error: (...args) => logs.push(args) });
  let failure;
  try { await client.sendTextMessage({ accessToken: "FAKE_SECRET", recipientId: "123", messageText: "PRIVATE_DM" }); }
  catch (error) { failure = error; }
  assert.equal(failure.code, "META_MESSAGE_PERMISSION_DENIED");
  assert.equal(failure.status, 400);
  assert.equal(JSON.stringify(failure.details), '{"error":{"code":200}}');
  assert.ok(!failure.message.includes("PRIVATE"));
  assert.ok(!JSON.stringify(logs).includes("PRIVATE"));
  assert.ok(!JSON.stringify(logs).includes("FAKE_SECRET"));
  assert.equal(calls, 1, "No automatic retry");

  const noop = () => {};
  const handlers = [];
  const app = { disable: noop, get: noop, use: (...args) => handlers.push(...args.filter(item => typeof item === "function")) };
  const express = () => app;
  express.json = () => noop;
  load("../src/app.js", name => {
    if (name === "express") return express;
    if (name === "cors") return () => noop;
    if (name === "./config/env") return { ADMIN_AUTH_ENABLED: true, getAllowedOrigins: () => [] };
    if (name.endsWith("admin-auth.middleware")) return { requireAdminSession: noop, requireCsrf: noop, requirePasswordChanged: noop, requirePermission: () => noop };
    if (name.endsWith("permissions.service")) return { PERMISSIONS: {} };
    if (name.endsWith("inbox-images.routes")) return { imageSendRoutes: noop, serveDeliveryImage: noop, serveConversationImage: noop };
    if (name.endsWith(".routes")) return noop;
    throw Error("Unexpected dependency: " + name);
  });
  const errorHandler = handlers.find(handler => handler.length === 4);
  assert.ok(errorHandler);
  const response = { status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  errorHandler(failure, {}, response, noop);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "META_MESSAGE_PERMISSION_DENIED");
  assert.ok(!JSON.stringify(response.body).includes("PRIVATE"));
  status = 500;
  await assert.rejects(client.sendTextMessage({ accessToken: "FAKE", recipientId: "123", messageText: "demo" }), error => error.status === 500);
  failure.deliveryMayHaveSucceeded = true;
  errorHandler(failure, {}, response, noop);
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.code, "MESSAGE_DELIVERY_UNCERTAIN", "Uncertainty takes precedence over permission feedback");
  console.log("Meta code 200 normalized safely, no payload/token logs or retries, app middleware 403 and uncertain 502 precedence. Isolated dependencies; no real Meta or DB calls.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
