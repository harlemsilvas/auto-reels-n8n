const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createHmac } = require("node:crypto");
const { Script } = require("node:vm");
const path = require("node:path");
const test = require("node:test");
const express = require("express");

function load(name, dependencies, logs) {
  const filename = path.resolve(__dirname, "../src/modules/webhooks", name);
  const module = { exports: {} };
  new Script(`(function(require,module,console){${readFileSync(filename, "utf8")}\n})`,
    { filename }).runInThisContext()((key) => {
    if (Object.hasOwn(dependencies, key)) return dependencies[key];
    throw new Error(`Unexpected dependency: ${key}`);
  }, module, { log: (...args) => logs.push(args), error: (...args) => logs.push(args) });
  return module.exports;
}

test("HTTP: original bytes, rejection before processing, GET and safe logs", async () => {
  const logs = [], processed = [];
  const config = { META_APP_SECRET: "demo-secret", META_WEBHOOK_VERIFY_TOKEN: "demo-verify" };
  const signature = load("instagram-webhook.signature.js", {
    express, "node:crypto": require("node:crypto"), "../../config/env": config,
  }, logs);
  const verify = load("instagram-webhook.verify.js", { "../../config/env": config }, logs);
  const controller = load("instagram-messages.controller.js", {
    "./instagram-messages.service": { async processWebhook(body) { processed.push(body); } },
  }, logs);
  const router = load("instagram-messages.routes.js", {
    express, "./instagram-webhook.verify": verify,
    "./instagram-messages.controller": controller,
    "./instagram-webhook.signature": signature,
  }, logs);
  const app = express();
  app.use("/api/webhooks/instagram", router);
  app.use(express.json());
  app.post("/ordinary-json", (req, res) => res.json(req.body));
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", error => error ? reject(error) : resolve(s));
    s.on("error", reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const sign = body => `sha256=${createHmac("sha256", config.META_APP_SECRET).update(body).digest("hex")}`;
  const raw = '{ "object":"instagram", "entry":[], "text":"\\u00e7" }';
  async function post(body, header, extra = {}) {
    return fetch(`${base}/api/webhooks/instagram`, { method: "POST", body,
      headers: { "content-type": "application/json", ...(header ? { "x-hub-signature-256": header } : {}), ...extra } });
  }
  try {
    assert.equal((await post(raw, sign(raw))).status, 200);
    assert.deepEqual(processed, [JSON.parse(raw)]);
    for (const header of [undefined, "sha256=00", `sha256=${"0".repeat(64)}`, "sha1=invalid",
      `${sign(raw)},${sign(raw)}`]) assert.equal((await post(raw, header)).status, 403);
    assert.equal((await post(JSON.stringify(JSON.parse(raw)), sign(raw))).status, 403);
    assert.equal((await post("{", sign("{"))).status, 400);
    assert.equal((await post(raw, sign(raw), { "content-type": "text/plain" })).status, 403);
    assert.equal((await post(raw, sign(raw), { "content-encoding": "gzip" })).status, 400);
    const large = "x".repeat(110000);
    assert.equal((await post(large, sign(large))).status, 413);
    assert.equal(processed.length, 1);
    let response = await fetch(`${base}/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=demo-verify&hub.challenge=demo-challenge`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "demo-challenge");
    for (const query of ["", "hub.mode=subscribe&hub.challenge=demo-challenge",
      "hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=demo-challenge",
      "hub.mode=subscribe&hub.verify_token=demo-verify&hub.verify_token=demo-verify&hub.challenge=demo-challenge"])
      assert.equal((await fetch(`${base}/api/webhooks/instagram?${query}`)).status, 403);
    response = await fetch(`${base}/ordinary-json`, { method: "POST", body: '{"value":1}',
      headers: { "content-type": "application/json" } });
    assert.deepEqual(await response.json(), { value: 1 });
    assert.doesNotMatch(JSON.stringify(logs), /demo-verify|demo-challenge|demo-secret|entry|\\u00e7/);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test("App Secret absent rejects POST, including when dashboard auth is disabled", () => {
  const security = load("instagram-webhook.signature.js", {
    express, "node:crypto": require("node:crypto"), "../../config/env": { META_APP_SECRET: "" },
  }, []);
  security.verifySignature({}, { sendStatus(status) { assert.equal(status, 503); } },
    () => assert.fail("Must not process unsigned event"));
});

test("GET without configured verify token never accepts an absent token", () => {
  const verify = load("instagram-webhook.verify.js", {
    "../../config/env": { META_WEBHOOK_VERIFY_TOKEN: "" },
  }, []);
  verify({ query: { "hub.mode": "subscribe", "hub.challenge": "demo" } }, {
    sendStatus(status) { assert.equal(status, 403); },
    status() { assert.fail("Missing configuration must reject"); },
  });
});
