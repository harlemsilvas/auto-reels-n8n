import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const conversations = [
  { id: "c1", accountId: "a1", instagramUserId: "123", instagramName: "Ana Silva", instagramUsername: "ana", unreadCount: 2, lastMessageText: "Gostaria de consultar uma pastilha.", lastMessageAt: "2026-10-10T17:20:00Z" },
  { id: "c2", accountId: "a1", instagramUserId: "456", instagramUsername: null, unreadCount: 0, lastMessageText: "Obrigado!" },
];
const messages = [
  { id: "m1", conversationId: "c1", sentBy: "user", messageText: "Ola! Gostaria de consultar uma pastilha para minha moto.", createdAt: "2026-10-09T17:20:00Z" },
  { id: "m2", conversationId: "c1", sentBy: "bot", messageText: "Ola, Ana. Qual e o modelo e ano da sua moto?", createdAt: "2026-10-10T17:21:00Z" },
  { id: "m3", conversationId: "c1", sentBy: "user", messageText: "Honda CB 500, ano 2022. " + "Texto longo ".repeat(15), createdAt: "2026-10-10T17:22:00Z" },
];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body = {};
    if (path === "/api/auth/status") body = { enabled: true };
    else if (path === "/api/auth/me") body = { user: { id: "admin", username: "admin", displayName: "Administrador de teste", role: "admin", forcePasswordChange: false } };
    else if (path === "/api/auth/csrf") body = { csrfToken: "fake-csrf" };
    else if (path === "/api/internal/conversations") body = { items: conversations, total: 2 };
    else if (path.endsWith("/messages")) body = { items: messages, total: 3 };
    else if (path === "/api/realtime/inbox") {
      await route.fulfill({ contentType: "text/event-stream", body: ": mock\n\n" });
      return;
    }
    await route.fulfill({ json: body });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:5181/inbox");
  await page.getByRole("button", { name: /Ana Silva/ }).waitFor();
  await page.locator(".inbox-message-bubble").first().waitFor();
  assert.equal(await page.locator(".inbox-message-bubble").count(), 3);
  assert.equal(await page.locator(".inbox-date-divider").count(), 2);
  assert.equal(await page.getByRole("button", { name: "Enviar mensagem", exact: true }).isDisabled(), true);
  await page.getByRole("textbox", { name: "Mensagem", exact: true }).fill("Resposta simulada");
  assert.equal(await page.getByRole("button", { name: "Enviar mensagem", exact: true }).isEnabled(), true);
  await page.getByRole("textbox", { name: "Buscar conversas" }).fill("nao existe");
  assert.equal(await page.locator(".inbox-conversation-item").count(), 0);
  await page.getByRole("textbox", { name: "Buscar conversas" }).fill("");
  await page.getByRole("button", { name: /Nao lidas/ }).click();
  assert.equal(await page.locator(".inbox-conversation-item").count(), 1);
  await page.getByRole("button", { name: /Todas/ }).click();
  await page.screenshot({ path: "/tmp/socialbot-inbox-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator(".inbox-sidebar").isVisible(), true);
  assert.equal(await page.locator(".inbox-chat").isVisible(), false);
  await page.getByRole("button", { name: /Ana Silva/ }).click();
  assert.equal(await page.locator(".inbox-chat").isVisible(), true);
  assert.equal(await page.locator(".inbox-sidebar").isVisible(), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "/tmp/socialbot-inbox-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Voltar para conversas" }).click();
  assert.equal(await page.locator(".inbox-sidebar").isVisible(), true);
  assert.deepEqual(errors, []);
  console.log("Inbox desktop/mobile: busca, filtro, datas, compositor e navegacao aprovados. Nenhuma API real acessada.");
} finally {
  await browser.close();
}
