import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
const base = process.env.DASHBOARD_TEST_URL || "http://localhost:5181";
async function language(page, code) {
  await page.locator(".language-selector select").selectOption(code);
  await page.waitForFunction(code => document.documentElement.lang === code, code);
}
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 960 } });
    await context.addInitScript(() => {
      localStorage.setItem("socialbot.language", "en");
      window.sourceCount = 0;
      window.EventSource = class extends EventTarget { constructor() { super(); window.sourceCount++; } close() {} };
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let sends = 0;
    let testerMessages = [];
    let hides = 0;
    let uncertain = false;
    let testers = [{ id: "c1", accountId: "a1", instagramUserId: "123", instagramName: "Ana Original", instagramUsername: "ana", lastMessageText: "Texto original", lastMessageAt: "2026-10-12T12:00:00Z" }];
    await context.route("**/api/**", async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      let body = {};
      let status = 200;
      if (path === "/api/auth/status") body = { enabled: true };
      else if (path === "/api/auth/me") body = { user: { id: "demo", username: "demo", role: "admin", forcePasswordChange: false } };
      else if (path === "/api/auth/csrf") body = { csrfToken: "fake" };
      else if (path === "/api/internal/conversations") body = { items: [
        { ...testers[0], id: "c1", lastMessageText: "[Imagem]", lastMessageKind: "text" },
        { id: "c2", accountId: "a1", instagramUserId: "456", instagramUsername: "bia", lastMessageText: "[Imagem]", lastMessageKind: "image", unreadCount: 2 },
      ] };
      else if (path.endsWith("/messages")) body = { items: [{ id: "m1", conversationId: "c1", sentBy: "user", messageText: "Original DM unchanged", createdAt: "2026-10-12T12:00:00Z" }] };
      else if (path.endsWith("/read")) body = { ok: true, unreadCount: 0 };
      else if (path === "/api/internal/messages/send") {
        sends++;
        status = uncertain ? 502 : 403;
        body = { code: uncertain ? "MESSAGE_DELIVERY_UNCERTAIN" : "META_MESSAGE_PERMISSION_DENIED", message: "PRIVATE PROVIDER PAYLOAD" };
      } else if (path === "/api/internal/testers-dm/conversations") body = { items: testers };
      else if (path === "/api/internal/testers-dm/send") {
        testerMessages.push(request.postDataJSON().message);
        body = { ok: true };
      } else if (path.startsWith("/api/internal/testers-dm/conversations/") && request.method() === "DELETE") { hides++; testers = []; body = { ok: true }; }
      await route.fulfill({ status, json: body });
    });
    await page.goto(`${base}/inbox`);
    await page.getByRole("button", { name: /ana/ }).waitFor();
    assert.ok((await page.getByRole("button", { name: /ana/ }).innerText()).includes("[Imagem]"), "Real DM text is not translated");
    assert.ok((await page.getByRole("button", { name: /bia/ }).innerText()).includes("[Image]"), "Structured attachment preview is translated");
    if (width < 761) await page.getByRole("button", { name: /ana/ }).click();
    await page.getByText("Original DM unchanged", { exact: true }).waitFor();
    await page.getByRole("textbox", { name: "Message", exact: true }).fill("Rascunho original");
    const sources = await page.evaluate(() => window.sourceCount);
    await language(page, "pt-BR");
    assert.equal(await page.getByRole("textbox", { name: "Mensagem", exact: true }).inputValue(), "Rascunho original");
    await language(page, "en");
    assert.equal(await page.evaluate(() => window.sourceCount), sources, "Locale does not reconnect SSE");
    assert.equal(sends, 0);
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Meta denied" }).waitFor();
    assert.ok(!(await page.locator("body").innerText()).includes("PRIVATE PROVIDER"));
    assert.equal(await page.getByRole("textbox", { name: "Message", exact: true }).inputValue(), "Rascunho original");
    await language(page, "pt-BR");
    assert.match(await page.getByRole("alert").innerText(), /Meta/);
    await language(page, "en");
    uncertain = true;
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Delivery is uncertain" }).waitFor();
    await language(page, "pt-BR");
    assert.ok(await page.getByRole("textbox", { name: "Mensagem", exact: true }).isDisabled());
    await language(page, "en");
    assert.ok(await page.getByRole("textbox", { name: "Message", exact: true }).isDisabled());
    assert.equal(sends, 2, "Locale never retries an uncertain send");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: `/tmp/i18n-inbox-${width}.png`, fullPage: true });
    await page.goto(`${base}/inbox/testers-dm`);
    await page.getByRole("heading", { name: "Instagram DM testers" }).waitFor();
    const draft = page.getByRole("textbox", { name: "Test message for @ana" });
    assert.equal(await draft.inputValue(), "SocialBot test message");
    await page.getByRole("button", { name: "Send test DM", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "DM sent to" }).waitFor();
    assert.deepEqual(testerMessages, ["SocialBot test message"]);
    await draft.fill("Conteudo escrito pelo usuario");
    await language(page, "pt-BR");
    assert.equal(await page.locator(".testers-table textarea").inputValue(), "Conteudo escrito pelo usuario");
    await language(page, "en");
    await page.getByRole("button", { name: "Send test flow", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".testers-table textarea")?.disabled);
    await language(page, "pt-BR");
    await page.getByRole("status").filter({ hasText: /Fluxo/ }).waitFor();
    assert.deepEqual(testerMessages.slice(1), ["Hello! This is a SocialBot test.", "Message 2: we received your DM correctly.", "Message 3: test completed successfully."]);
    await language(page, "en");
    assert.equal(await draft.inputValue(), "Conteudo escrito pelo usuario");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: `/tmp/i18n-testers-${width}.png`, fullPage: true });
    page.once("dialog", dialog => { assert.match(dialog.message(), /Inbox history is preserved/); void dialog.dismiss(); });
    await page.getByRole("button", { name: "Hide", exact: true }).click();
    assert.equal(hides, 0);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Hide", exact: true }).click();
    await page.getByText("No tester conversations received.").waitFor();
    assert.equal(hides, 1);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("PT/EN Inbox/Testers desktop/390/320: drafts and customer content preserved, structured previews, safe permission feedback, uncertain-send blocking, SSE stability, default DM, flow locale snapshot, hide confirmation and layout. Mock APIs; zero real Meta sends.");
} finally { await browser.close(); }
