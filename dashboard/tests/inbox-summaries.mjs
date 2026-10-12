import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const items = [
      { id: "c1", accountId: "a1", instagramUserId: "123", instagramName: "Ana Silva", instagramUsername: "ana", lastMessageText: "[Imagem]", lastMessageAt: "2026-10-12T10:00:00Z", unreadCount: 0 },
      { id: "c2", accountId: "a1", instagramUserId: "456", instagramName: null, instagramUsername: "bia", lastMessageText: "[Anexos]", lastMessageAt: "2026-10-12T10:01:00Z", unreadCount: 1 },
      { id: "c3", accountId: "a1", instagramUserId: "789", instagramName: null, instagramUsername: null, lastMessageText: "Legenda mais recente", unreadCount: 0 },
    ];
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      let body = { items: [] };
      if (path === "/api/auth/status") body = { enabled: true };
      else if (path === "/api/auth/me") body = { user: { id: "admin", username: "admin", role: "admin", forcePasswordChange: false } };
      else if (path === "/api/auth/csrf") body = { csrfToken: "fake" };
      else if (path === "/api/internal/conversations") body = { items };
      else if (path === "/api/internal/conversations/c1/read") {
        assert.deepEqual(route.request().postDataJSON(), { messageIds: [] });
        body = { ok: true, unreadCount: 0 };
      }
      else if (route.request().method() !== "GET") throw Error(`Escrita inesperada: ${path}`);
      await route.fulfill({ json: body });
    });
    await page.goto("http://127.0.0.1:5181/inbox");
    const sidebar = page.getByRole("complementary", { name: "Conversas Instagram" });
    await sidebar.getByRole("button", { name: /Ana Silva/ }).waitFor();
    assert.match(await sidebar.getByRole("button", { name: /Ana Silva/ }).innerText(), /@ana.*\[Imagem\]/s);
    assert.match(await sidebar.getByRole("button", { name: /bia/ }).innerText(), /\[Anexos\]/);
    await sidebar.getByRole("button", { name: /ID 789/ }).waitFor();
    const search = sidebar.getByRole("textbox", { name: "Buscar conversas" });
    await search.fill("Ana Silva");
    assert.equal(await sidebar.locator(".inbox-conversation-item").count(), 1);
    await search.fill("imagem");
    assert.equal(await sidebar.locator(".inbox-conversation-item").count(), 1);
    await search.fill("789");
    assert.equal(await sidebar.locator(".inbox-conversation-item").count(), 1);
    await search.fill("");
    await sidebar.getByRole("button", { name: /Nao lidas/ }).click();
    assert.equal(await sidebar.locator(".inbox-conversation-item").count(), 1);
    await sidebar.getByRole("button", { name: /Todas/ }).click();
    items[2].instagramName = "Carlos Silva";
    items[2].instagramUsername = "carlos";
    await sidebar.getByRole("button", { name: "Atualizar conversas", exact: true }).click();
    await sidebar.getByRole("button", { name: /Carlos Silva/ }).waitFor();
    assert.match(await sidebar.getByRole("button", { name: /Carlos Silva/ }).innerText(), /@carlos/);
    assert.equal(await sidebar.getByRole("button", { name: /ID 789/ }).count(), 0);
    await page.screenshot({ path: `/tmp/inbox-summaries-${mobile ? "mobile" : "desktop"}.png` });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Aprovados desktop/mobile: nome/username/ID, resumos de imagem/anexos, busca e filtro nao lidas. APIs simuladas; sem mensagens reais.");
} finally { await browser.close(); }
