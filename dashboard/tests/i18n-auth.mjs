import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
const base = process.env.DASHBOARD_TEST_URL || "http://localhost:5181";
const contexts = [];
const errors = [];
const user = { id: "review-demo", username: "review-demo", displayName: "HRM Demo", role: "admin", forcePasswordChange: false };
async function client(width, initial = null, blocked = false) {
  const context = await browser.newContext({ viewport: { width, height: 960 }, locale: "en-US", timezoneId: "America/Sao_Paulo" });
  contexts.push(context);
  await context.addInitScript(({ initial, blocked }) => {
    if (initial) localStorage.setItem("socialbot.language", initial);
    if (blocked) {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) { if (key === "socialbot.language") throw new DOMException("Denied", "SecurityError"); return get.call(this, key); };
      Storage.prototype.setItem = function (key, value) { if (key === "socialbot.language") throw new DOMException("Denied", "SecurityError"); return set.call(this, key, value); };
    }
    window.EventSource = class extends EventTarget { close() {} };
  }, { initial, blocked });
  const state = { signedIn: false, loginOK: false, passwordOK: false, loginCalls: 0, passwordCalls: 0, sendCalls: 0, held: false, release: null };
  await context.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    let body = {};
    let status = 200;
    if (url.pathname === "/api/auth/status") body = { enabled: true };
    else if (url.pathname === "/api/auth/me") { status = state.signedIn ? 200 : 401; body = { user }; }
    else if (url.pathname === "/api/auth/csrf") body = { csrfToken: "test-csrf" };
    else if (url.pathname === "/api/auth/login") {
      state.loginCalls++;
      if (state.held) await new Promise(resolve => { state.release = resolve; });
      state.signedIn = state.loginOK;
      status = state.loginOK ? 200 : 401;
      body = state.loginOK ? { user, csrfToken: "test-csrf" } : { message: "Provider error not for display" };
    } else if (url.pathname === "/api/auth/logout") {
      assert.equal(request.headers()["x-csrf-token"], "test-csrf");
      state.signedIn = false;
      body = { ok: true };
    } else if (url.pathname === "/api/auth/change-password") {
      assert.equal(request.headers()["x-csrf-token"], "test-csrf");
      state.passwordCalls++;
      status = state.passwordOK ? 200 : 500;
      body = state.passwordOK ? { ok: true } : { message: "Private provider payload must not appear" };
    } else if (url.pathname === "/api/internal/conversations") body = { items: [{ id: "c1", accountId: "a1", instagramUserId: "123", instagramUsername: "demo" }], total: 1 };
    else if (url.pathname.endsWith("/messages")) body = { items: [{ id: "m1", conversationId: "c1", sentBy: "user", messageText: "Original DM unchanged", createdAt: "2026-10-12T10:00:00Z" }] };
    else if (url.pathname.endsWith("/read")) body = { ok: true, unreadCount: 0 };
    else if (url.pathname === "/api/internal/messages/send") { state.sendCalls++; throw Error("Language switch must not send DM"); }
    else if (url.pathname === "/api/internal/accounts") body = { items: [], total: 0 };
    await route.fulfill({ status, json: body });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  return { context, page, state };
}
async function language(page, code) {
  await page.locator(".language-selector select").selectOption(code);
  await page.waitForFunction(code => document.documentElement.lang === code, code);
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "No horizontal overflow");
  const selector = page.locator(".language-selector");
  const box = await selector.boundingBox();
  assert.ok(box.width <= 137 && box.height >= 35, "Stable selector dimensions");
}
try {
  for (const width of [1440, 390, 320]) {
    const { page, context, state } = await client(width);
    await page.goto(`${base}/login`);
    await page.getByRole("heading", { name: "Acesso Admin" }).waitFor();
    assert.equal(await page.locator("html").getAttribute("lang"), "pt-BR", "Default Portuguese even with English browser");
    await page.getByLabel("Usu\u00e1rio", { exact: true }).fill("review-demo");
    await page.getByLabel("Senha", { exact: true }).fill("demo-not-real-password");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("alert").waitFor();
    await language(page, "en");
    assert.match(await page.getByRole("alert").innerText(), /Unable to sign in/);
    assert.equal(await page.getByLabel("Username", { exact: true }).inputValue(), "review-demo");
    assert.equal(await page.getByLabel("Password", { exact: true }).inputValue(), "demo-not-real-password");
    assert.equal(await page.title(), "SocialBot | Dashboard");
    await noOverflow(page);
    await page.screenshot({ path: `/tmp/i18n-login-${width}.png`, fullPage: true });
    await page.reload();
    await page.getByRole("heading", { name: "Admin access" }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("socialbot.language")), "en");
    state.loginOK = true;
    await page.getByLabel("Username", { exact: true }).fill("review-demo");
    await page.getByLabel("Password", { exact: true }).fill("demo-not-real-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await page.goto(`${base}/inbox`);
    if (width < 761) await page.getByRole("button", { name: /demo/ }).click();
    const draft = page.getByRole("textbox", { name: /^(Message|Mensagem)$/, exact: true });
    await draft.fill("Rascunho original / Original draft");
    await language(page, "pt-BR");
    assert.equal(await draft.inputValue(), "Rascunho original / Original draft");
    await language(page, "en");
    assert.equal(await draft.inputValue(), "Rascunho original / Original draft");
    assert.equal(state.sendCalls, 0);
    assert.equal(await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Accounts", exact: true }).count(), 1);
    await page.getByText("Original DM unchanged", { exact: true }).waitFor();
    await noOverflow(page);
    await page.screenshot({ path: `/tmp/i18n-layout-${width}.png`, fullPage: true });
    if (width === 1440) {
      const second = await context.newPage();
      await second.goto(`${base}/contas`);
      await second.locator(".language-selector select").waitFor();
      await language(page, "pt-BR");
      await second.waitForFunction(() => document.documentElement.lang === "pt-BR");
      await second.close();
      await page.goto(`${base}/change-password`);
      await page.getByLabel("Senha atual", { exact: true }).fill("old-demo-password");
      await page.getByLabel("Nova senha", { exact: true }).fill("new-demo-password");
      await page.getByLabel("Confirmar nova senha", { exact: true }).fill("different-demo-password");
      await page.getByRole("button", { name: "Alterar senha", exact: true }).click();
      assert.equal(state.passwordCalls, 0);
      await language(page, "en");
      assert.match(await page.getByRole("alert").innerText(), /does not match/);
      assert.equal(await page.getByLabel("Current password", { exact: true }).inputValue(), "old-demo-password");
      await page.getByLabel("Confirm new password", { exact: true }).fill("new-demo-password");
      await page.getByRole("button", { name: "Change password", exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes("Unable to change"));
      assert.equal(state.passwordCalls, 1);
      assert.ok(!(await page.locator("body").innerText()).includes("Private provider"));
      await page.goto(`${base}/contas`);
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await page.waitForURL("**/login");
      await page.getByRole("heading", { name: "Admin access" }).waitFor();
      const formats = await page.evaluate(async () => {
        const formatter = await import("/src/shared/i18n/formatters.ts");
        const { default: i18n } = await import("/src/shared/i18n/index.ts");
        const date = new Date("2026-02-13T15:00:00Z");
        const timestamp = date.getTime();
        const options = { year: "numeric", month: "2-digit", day: "2-digit" };
        const en = formatter.formatDateTime(date, options);
        const enNumber = formatter.formatNumber(1234.5);
        await i18n.changeLanguage("pt-BR");
        return { en, enNumber, pt: formatter.formatDateTime(date, options), ptNumber: formatter.formatNumber(1234.5),
          badDate: formatter.formatDateTime("invalid"), badNumber: formatter.formatNumber(NaN), preserved: timestamp === date.getTime() };
      });
      assert.equal(formats.en, "02/13/2026"); assert.equal(formats.pt, "13/02/2026");
      assert.equal(formats.enNumber, "1,234.5"); assert.equal(formats.ptNumber, "1.234,5");
      assert.equal(formats.badDate, "-"); assert.equal(formats.badNumber, "-"); assert.equal(formats.preserved, true);
    }
  }
  const invalid = await client(390, "unsupported");
  await invalid.page.goto(`${base}/login`);
  await invalid.page.getByRole("heading", { name: "Acesso Admin" }).waitFor();
  const blocked = await client(390, null, true);
  await blocked.page.goto(`${base}/login`);
  await blocked.page.getByRole("heading", { name: "Acesso Admin" }).waitFor();
  await language(blocked.page, "en");
  await blocked.page.getByRole("heading", { name: "Admin access" }).waitFor();
  await noOverflow(blocked.page);
  const busy = await client(390);
  busy.state.held = true;
  await busy.page.goto(`${base}/login`);
  await busy.page.getByLabel("Usu\u00e1rio", { exact: true }).fill("review-demo");
  await busy.page.getByLabel("Senha", { exact: true }).fill("demo-not-real-password");
  await busy.page.getByRole("button", { name: "Entrar", exact: true }).click();
  await busy.page.getByRole("button", { name: "Entrando...", exact: true }).waitFor();
  assert.equal(await busy.page.getByRole("button", { name: "Entrando...", exact: true }).isDisabled(), true);
  await language(busy.page, "en");
  assert.equal(await busy.page.getByRole("button", { name: "Signing in...", exact: true }).isDisabled(), true);
  assert.equal(busy.state.loginCalls, 1);
  assert.equal(typeof busy.state.release, "function");
  busy.state.release();
  await busy.page.getByRole("alert").waitFor();
  const password = await client(390);
  password.state.signedIn = true;
  password.state.passwordOK = true;
  await password.page.goto(`${base}/change-password`);
  await language(password.page, "en");
  await password.page.getByLabel("Current password", { exact: true }).fill("old-demo-password");
  await password.page.getByLabel("New password", { exact: true }).fill("old-demo-password");
  await password.page.getByLabel("Confirm new password", { exact: true }).fill("old-demo-password");
  await password.page.getByRole("button", { name: "Change password", exact: true }).click();
  assert.match(await password.page.getByRole("alert").innerText(), /must differ/);
  assert.equal(password.state.passwordCalls, 0);
  await password.page.getByLabel("New password", { exact: true }).fill("new-demo-password");
  await password.page.getByLabel("Confirm new password", { exact: true }).fill("new-demo-password");
  await password.page.getByRole("button", { name: "Change password", exact: true }).click();
  await password.page.waitForURL("**/login");
  assert.equal(password.state.passwordCalls, 1);
  await password.page.getByRole("heading", { name: "Admin access" }).waitFor();
  assert.deepEqual(errors, []);
  console.log("Aprovados PT/EN desktop/390/320: auth/layout, erro reativo, persistencia/fallback/storage negado, sync abas, CSRF/logout, rascunho/DM preservados, Intl e layout. APIs simuladas; zero Meta real.");
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
