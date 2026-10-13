import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
const errors = [];
const id = "33333333-3333-4333-8333-333333333333";
const demo = { id, nome: "HRM Demonstra\u00e7\u00e3o", instagramId: "17841400000000000", pageId: "12345", ativo: true, tokenExpiresAt: "2026-02-13T15:00:00Z" };
const base = process.env.DASHBOARD_TEST_URL || "http://localhost:5181";
const contexts = [];
async function client(width) {
  const context = await browser.newContext({ viewport: { width, height: 960 }, timezoneId: "America/Sao_Paulo" });
  contexts.push(context);
  await context.addInitScript(() => { localStorage.setItem("socialbot.language", "en"); });
  const state = { items: [{ ...demo }], listFail: false, saveFail: true, importFail: false, held: false, release: null, mutations: [], meta: 0, togglesFail: false };
  await context.route("**/api/**", async route => {
    const req = route.request(); const url = new URL(req.url()); let status = 200; let body = {};
    if (url.pathname === "/api/auth/status") body = { enabled: true };
    else if (url.pathname === "/api/auth/me") body = { user: { id: "review", username: "review", role: "admin", forcePasswordChange: false } };
    else if (url.pathname === "/api/auth/csrf") body = { csrfToken: "test-csrf" };
    else if (url.pathname === "/api/auth/meta/login") { state.meta++; await route.fulfill({ status: 302, headers: { location: `${base}/contas?error=meta_configuration_unavailable` } }); return; }
    else if (url.pathname === "/api/internal/accounts" && req.method() === "GET") {
      if (state.held) await new Promise(resolve => { state.release = resolve; });
      status = state.listFail ? 500 : 200; body = state.listFail ? { message: "PRIVATE_PROVIDER_MESSAGE" } : { items: state.items, total: state.items.length };
    } else if (url.pathname.startsWith("/api/internal/accounts")) {
      assert.equal(req.headers()["x-csrf-token"], "test-csrf");
      state.mutations.push({ path: url.pathname, input: req.postDataJSON() });
      const fail = url.pathname.endsWith("/bootstrap-env") ? state.importFail : url.pathname.endsWith("/active") ? state.togglesFail : state.saveFail;
      status = fail ? 400 : 200;
      if (!fail && url.pathname.endsWith("/active")) state.items[0].ativo = req.postDataJSON().ativo;
      body = fail ? { message: "PRIVATE_PROVIDER_MESSAGE" } : { ...demo, account: demo, message: "Mensagem do servidor em portugues" };
    }
    await route.fulfill({ status, json: body });
  });
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  return { page, state };
}
async function lang(page, code) { await page.locator(".language-selector select").selectOption(code); await page.waitForFunction(code => document.documentElement.lang === code, code); }
async function clean(page) { await page.waitForFunction(() => !new URL(location.href).searchParams.has("error") && !new URL(location.href).searchParams.has("connected")); }
try {
  for (const width of [1440, 390, 320]) {
    const { page, state } = await client(width);
    await page.goto(`${base}/contas?connected=true&accountId=${id}&filter=active`);
    await page.getByText(`Account connected: ${demo.nome}`, { exact: true }).waitFor();
    await clean(page);
    assert.equal(new URL(page.url()).searchParams.get("filter"), "active");
    assert.equal(await page.getByLabel("Access token", { exact: true }).isVisible(), false);
    const time = page.locator("time");
    assert.match(await time.innerText(), /2\/13\/26/);
    await lang(page, "pt-BR");
    await page.getByText(`Conta conectada: ${demo.nome}`, { exact: true }).waitFor();
    assert.match(await time.innerText(), /13\/02\/2026/);
    await lang(page, "en");
    await page.screenshot({ path: `/tmp/accounts-en-${width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.getByText("Technical maintenance", { exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Modelo original PT");
    await page.getByLabel("Instagram ID", { exact: true }).fill("17841400000000000");
    await page.getByLabel("Access token", { exact: true }).fill("fixture-only-not-real");
    await page.getByLabel("Token expiry (optional)", { exact: true }).fill("2026-12-31T23:59:59Z");
    assert.equal(await page.getByLabel("Access token", { exact: true }).getAttribute("type"), "password");
    await page.getByRole("button", { name: "Save account", exact: true }).click();
    await page.getByText("Unable to save the account. Check the fields and try again.", { exact: true }).waitFor();
    await lang(page, "pt-BR");
    assert.equal(await page.getByLabel("Nome", { exact: true }).inputValue(), "Modelo original PT");
    assert.equal(await page.getByLabel("Token de acesso", { exact: true }).inputValue(), "fixture-only-not-real");
    assert.ok(!(await page.locator("body").innerText()).includes("PRIVATE_PROVIDER"));
    await lang(page, "en");
    state.saveFail = false;
    await page.getByRole("button", { name: "Save account", exact: true }).click();
    await page.getByText("Account saved.", { exact: true }).waitFor();
    assert.equal(state.mutations.at(-1).input.tokenExpiresAt, "2026-12-31T23:59:59Z");
    assert.equal(await page.getByLabel("Access token", { exact: true }).inputValue(), "");
    const toggle = page.getByRole("switch", { name: `Account active: ${demo.nome}`, exact: true });
    await toggle.waitFor();
    await toggle.click();
    await page.getByText("Account status updated.", { exact: true }).waitFor();
    await page.getByText("Inactive", { exact: true }).waitFor();
    assert.equal(await toggle.isChecked(), false);
    state.togglesFail = true;
    await toggle.click();
    await page.getByText("Unable to update the account status.", { exact: true }).waitFor();
    assert.equal(await toggle.isChecked(), false);
    const before = state.mutations.length;
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("button", { name: "Import configured account", exact: true }).click();
    assert.equal(state.mutations.length, before);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Import configured account", exact: true }).click();
    await page.getByText("Configured account imported.", { exact: true }).waitFor();
    assert.ok(!(await page.locator("body").innerText()).includes("Mensagem do servidor"));
    state.importFail = true;
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Import configured account", exact: true }).click();
    await page.getByText("Unable to import the configured account.", { exact: true }).waitFor();
    assert.ok(!(await page.locator("body").innerText()).includes("PRIVATE_PROVIDER"));
    state.listFail = true;
    await page.getByRole("button", { name: "Refresh accounts", exact: true }).click();
    await page.getByText("Unable to load accounts. Try refreshing the list.", { exact: true }).waitFor();
    state.listFail = false; state.items = [];
    await page.getByRole("button", { name: "Refresh accounts", exact: true }).click();
    await page.getByText("No accounts connected.", { exact: true }).waitFor();
    await page.getByText("Meta returned a connection result, but the account could not be identified in this list. Refresh the list before continuing.", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.getByRole("button", { name: "Connect with Meta", exact: true }).click();
    await page.getByText("Meta connection is not configured in this environment.", { exact: true }).waitFor();
    assert.equal(state.meta, 1);
    await clean(page);
  }
  const { page, state } = await client(390);
  for (const [code, text] of [
    ["access_denied", "Meta authorization was canceled or denied."],
    ["invalid_oauth_state", "The connection request expired"],
    ["missing_oauth_code", "Meta did not return an authorization code"],
    ["no_facebook_pages", "No accessible Facebook Page"],
    ["no_instagram_account", "No Instagram professional account"],
    ["oauth_callback_error", "Unable to complete the Meta connection"],
    ["<script>PRIVATE_PROVIDER_MESSAGE</script>", "Unable to complete the Meta connection"],
  ]) {
    await page.goto(`${base}/contas?error=${encodeURIComponent(code)}&accountId=${id}`);
    await page.getByRole("alert").waitFor();
    assert.ok((await page.getByRole("alert").innerText()).includes(text));
    assert.ok(!(await page.locator("body").innerText()).includes("PRIVATE_PROVIDER"));
    await clean(page);
  }
  state.items = [];
  await page.goto(`${base}/contas?connected=true`);
  await page.getByText(/Meta returned a connection result/).waitFor();
  assert.equal(await page.getByText(/Account connected:/).count(), 0);
  state.items = [{ ...demo }];
  await page.getByRole("button", { name: "Refresh accounts", exact: true }).click();
  await page.getByRole("switch").waitFor();
  state.held = true;
  await page.getByRole("button", { name: "Refresh accounts", exact: true }).click();
  await page.getByText("Loading accounts...", { exact: true }).waitFor();
  await lang(page, "pt-BR");
  await page.getByText("Carregando contas...", { exact: true }).waitFor();
  assert.equal(typeof state.release, "function");
  state.held = false;
  state.release();
  await page.getByRole("switch").waitFor();
  assert.deepEqual(errors, []);
  console.log("Aprovados Contas PT/EN desktop/390/320: OAuth seguro/conta conferida/legado, query consumida, datas, formulario preservado, token mascarado, status/importacao/CSRF/falhas e layout. APIs simuladas.");
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
