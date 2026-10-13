const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const root = path.resolve(__dirname, "../src");
function stub(file, exports) {
  const id = require.resolve(file);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const auth = { sessionId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222", role: "admin" };
const accountId = "33333333-3333-4333-8333-333333333333";
const config = { ADMIN_AUTH_ENABLED: true, ADMIN_AUTH_COOKIE_NAME: "fixture-session",
  META_APP_ID: "fixture-app", META_APP_SECRET: "fixture-secret", META_REDIRECT_URI: "https://example.test/api/auth/meta/callback",
  META_GRAPH_API_VERSION: "v25.0", FRONTEND_URL: process.env.OAUTH_TEST_FRONTEND_URL || "https://example.test/" };
stub(path.join(root, "config/env"), config);
stub(path.join(root, "modules/auth/admin-auth.service"), {
  authenticateToken: async token => token === "admin" ? auth : token === "operator" ? { ...auth, role: "operator" } : null,
  validateCsrf: () => true,
});
const states = [];
stub(path.join(root, "lib/db"), { query: async (sql, args) => {
  if (sql.includes("INSERT INTO socialbot_oauth_states")) {
    states.push({ session: args[0], user: args[1], hash: args[2], expiry: args[3], consumed: false });
    return { rowCount: 1 };
  }
  if (sql.includes("UPDATE socialbot_oauth_states")) {
    const row = states.find(item => item.hash.equals(args[0]) && item.session === args[1] && item.user === args[2] && !item.consumed && item.expiry > new Date());
    if (row) row.consumed = true;
    return { rowCount: row ? 1 : 0 };
  }
  if (sql.includes("DELETE FROM socialbot_oauth_states")) return { rowCount: 0 };
  throw Error("Unexpected DB call");
} });
const saved = [];
const audits = [];
stub(path.join(root, "modules/accounts/accounts.service"), { upsertAccount: async input => {
  saved.push(input); return { id: accountId, nome: input.nome, instagramId: input.instagramId };
} });
stub(path.join(root, "modules/auth/admin-auth.repository"), { insertAuditLog: async input => audits.push(input) });
let mode = "success";
let calls = 0;
stub("axios", { get: async (url, options) => {
  calls++;
  if (mode === "failure") throw Object.assign(Error("PRIVATE_FIXTURE_PROVIDER_MESSAGE"), { response: { status: 500, data: { access_token: "PRIVATE_FIXTURE_TOKEN" } } });
  const pathname = new URL(url).pathname;
  if (pathname.endsWith("/oauth/access_token")) return { data: { access_token: options.params.code ? "fixture-short" : "fixture-long", expires_in: 3600 } };
  if (pathname.endsWith("/me/accounts")) return { data: { data: mode === "no_pages" ? [] : [{ id: "page-demo", name: "Demo", access_token: "fixture-page", ...(mode === "no_ig" ? {} : { instagram_business_account: { id: "ig-demo" } }) }] } };
  if (pathname.endsWith("/me")) return { data: { id: "facebook-demo", name: "Demo" } };
  if (pathname.endsWith("/ig-demo")) return { data: { id: "ig-demo", name: "HRM Demo", username: "demo" } };
  throw Error("Unexpected Meta call");
} });
const service = require(path.join(root, "modules/auth/meta-oauth.service"));
const controller = require(path.join(root, "modules/auth/meta-oauth.controller"));
const logs = [];
const originalLog = console.log;
const originalError = console.error;
console.log = console.error = (...args) => logs.push(JSON.stringify(args));
async function callback(query) {
  let location;
  await controller.handleMetaCallback({ query, auth, ip: "127.0.0.1", get: () => "fixture-agent" }, { redirect: url => { location = url; } });
  return new URL(location);
}
(async () => {
  let server;
  try {
    assert.equal(new URL(service.buildErrorRedirect("PRIVATE_FIXTURE_TOKEN")).searchParams.get("error"), "oauth_callback_error");
    assert.equal(new URL(service.buildErrorRedirect("access_denied")).pathname, "/contas");
    assert.equal(new URL(service.buildSuccessRedirect(accountId)).pathname, "/contas");
    const state = await service.createOAuthState(auth, "127.0.0.1");
    assert.equal(await service.consumeOAuthState(state, { ...auth, sessionId: "other" }), false);
    assert.equal(await service.consumeOAuthState([state], auth), false);
    const success = await callback({ state, code: "fixture-code" });
    assert.equal(success.searchParams.get("accountId"), accountId);
    assert.equal(success.searchParams.get("connected"), "true");
    assert.equal(saved.length, 1); assert.equal(audits.length, 1);
    const replayCalls = calls;
    assert.equal((await callback({ state, code: "fixture-code" })).searchParams.get("error"), "invalid_oauth_state");
    assert.equal(calls, replayCalls);
    const expired = await service.createOAuthState(auth, "127.0.0.1");
    states.at(-1).expiry = new Date(0);
    assert.equal((await callback({ state: expired, code: "fixture-code" })).searchParams.get("error"), "invalid_oauth_state");
    for (const [query, expected] of [[{ error: "access_denied", error_reason: "PRIVATE_FIXTURE_TOKEN" }, "access_denied"], [{ code: ["fixture-code"] }, "missing_oauth_code"], [{}, "missing_oauth_code"]]) {
      const state = await service.createOAuthState(auth, "127.0.0.1");
      assert.equal((await callback({ ...query, state })).searchParams.get("error"), expected);
    }
    for (const [nextMode, expected] of [["no_pages", "no_facebook_pages"], ["no_ig", "no_instagram_account"], ["failure", "oauth_callback_error"]]) {
      mode = nextMode;
      const state = await service.createOAuthState(auth, "127.0.0.1");
      assert.equal((await callback({ state, code: "fixture-code" })).searchParams.get("error"), expected);
    }
    assert.ok(!logs.join().includes("PRIVATE_FIXTURE"), "Provider error/token not logged");
    assert.equal(saved.length, 1, "Failures do not persist accounts");
    const app = express();
    app.use("/api/auth/meta", require(path.join(root, "modules/auth/meta-oauth.routes")));
    server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/auth/meta`;
    assert.equal((await fetch(`${base}/login`, { redirect: "manual" })).status, 401);
    assert.equal((await fetch(`${base}/login`, { redirect: "manual", headers: { Cookie: "fixture-session=operator" } })).status, 403);
    const login = await fetch(`${base}/login`, { redirect: "manual", headers: { Cookie: "fixture-session=admin" } });
    assert.equal(login.status, 302);
    const loginURL = new URL(login.headers.get("location"));
    assert.equal(loginURL.hostname, "www.facebook.com");
    assert.ok(loginURL.searchParams.get("state"));
    assert.ok(loginURL.searchParams.get("scope").includes("instagram_manage_messages"));
    config.META_APP_SECRET = "";
    delete require.cache[require.resolve(path.join(root, "modules/auth/meta-oauth.controller"))];
    const missing = require(path.join(root, "modules/auth/meta-oauth.controller"));
    let location;
    await missing.redirectToMetaLogin({ auth }, { redirect: url => { location = url; } });
    assert.equal(new URL(location).searchParams.get("error"), "meta_configuration_unavailable");
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    console.log = originalLog; console.error = originalError;
  }
  console.log("Aprovados OAuth: state/sessao/expiracao/replay, cancelamento, codigo invalido, paginas/IG ausentes, sucesso/conta, falha sanitizada, config ausente e HTTP 401/403/admin. DB/Meta simulados; zero rede Meta.");
})().catch(error => { console.error(error); process.exitCode = 1; });
