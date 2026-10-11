import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    const reads = [];
    const counts = { c1: 2, c2: 1 };
    const conversations = () => ["c1", "c2"].map((id, index) => ({
      id, accountId: "a1", instagramUserId: String(index + 123),
      instagramUsername: index ? "bia" : "ana", unreadCount: counts[id],
    }));
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body = {};
      if (path === "/api/auth/status") body = { enabled: true };
      else if (path === "/api/auth/me") body = { user: { id: "admin", username: "admin", role: "admin", forcePasswordChange: false } };
      else if (path === "/api/auth/csrf") body = { csrfToken: "fake" };
      else if (path === "/api/internal/conversations") body = { items: conversations() };
      else if (path.endsWith("/messages")) {
        const id = path.split("/").at(-2);
        body = { items: [{ id: `m-${id}`, conversationId: id, sentBy: "user", messageText: `Mensagem ${id}`, createdAt: "2026-10-11T10:00:00Z" }] };
      } else if (path.endsWith("/read")) {
        const id = path.split("/").at(-2);
        const payload = route.request().postDataJSON();
        assert.deepEqual(payload, { messageIds: [`m-${id}`] });
        reads.push(id);
        counts[id] = 0;
        body = { ok: true, unreadCount: 0 };
      }
      await route.fulfill({ json: body });
    });
    await page.goto("http://127.0.0.1:5181/inbox");
    await page.getByRole("button", { name: /bia/ }).waitFor();
    if (mobile) {
      await page.waitForTimeout(250);
      assert.deepEqual(reads, [], "Lista mobile nao reconhece conversa oculta");
      assert.equal(await page.locator(".inbox-unread").count(), 2);
      await page.getByRole("button", { name: /ana/ }).click();
    }
    await page.waitForFunction(() => document.querySelectorAll(".inbox-unread").length === 1);
    assert.ok(reads.includes("c1"));
    assert.equal(counts.c2, 1, "Ler Ana nao altera Bia");
    if (mobile) await page.getByRole("button", { name: "Voltar para conversas" }).click();
    await page.getByRole("button", { name: /Nao lidas/ }).click();
    assert.equal(await page.getByRole("button", { name: /ana/ }).count(), 0);
    await page.getByRole("button", { name: /bia/ }).click();
    await page.waitForFunction(() => document.querySelectorAll(".inbox-unread").length === 0);
    assert.ok(reads.includes("c2"));
    await page.screenshot({ path: `/tmp/inbox-unread-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
    await page.close();
  }
  console.log("Aprovados: badges, filtro nao lidas, IDs reconhecidos, escopo por conversa e lista mobile sem leitura automatica. APIs simuladas.");
} finally {
  await browser.close();
}
