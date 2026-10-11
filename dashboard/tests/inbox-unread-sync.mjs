import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.streams = [];
      window.EventSource = class extends EventTarget {
        constructor() { super(); window.streams.push(this); }
        close() {}
      };
    });
    const counts = { c1: 0, c2: 0 };
    let reads = 0;
    let delayed = false;
    let release;
    let listStarted = false;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body = {};
      if (path === "/api/auth/status") body = { enabled: true };
      else if (path === "/api/auth/me") body = { user: { id: "admin", username: "admin", role: "admin", forcePasswordChange: false } };
      else if (path === "/api/auth/csrf") body = { csrfToken: "fake" };
      else if (path === "/api/internal/conversations") {
        body = { items: ["c1", "c2"].map((id, index) => ({ id, accountId: "a1", instagramUserId: String(index + 123),
          instagramUsername: index ? "bia" : "ana", unreadCount: counts[id] })) };
        if (delayed) {
          delayed = false;
          listStarted = true;
          await new Promise((resolve) => { release = resolve; });
        }
      } else if (path.endsWith("/messages")) {
        const id = path.split("/").at(-2);
        body = { items: [{ id: `m-${id}`, conversationId: id, sentBy: "user", messageText: "Mensagem", createdAt: "2026-10-11T10:00:00Z" }] };
      } else if (path.endsWith("/read")) {
        const id = path.split("/").at(-2);
        reads++;
        counts[id] = 0;
        body = { ok: true, unreadCount: 0 };
      }
      await route.fulfill({ json: body });
    });
    const until = async (condition) => {
      const deadline = Date.now() + 10000;
      while (!await condition()) {
        assert.ok(Date.now() < deadline, "Atualizacao nao ocorreu no prazo");
        await page.waitForTimeout(50);
      }
    };
    await page.goto("http://127.0.0.1:5181/inbox");
    await page.getByRole("button", { name: /bia/ }).waitFor();
    if (mobile) await page.getByRole("button", { name: /ana/ }).click();
    await until(() => reads > 0);

    counts.c2 = 2;
    await page.getByLabel("2 mensagens nao lidas").waitFor({ state: "attached", timeout: 10000 });
    assert.equal(await page.locator(".inbox-unread").count(), 1, "Lista atualiza mesmo sem SSE");

    counts.c1 = 2;
    counts.c2 = 3;
    delayed = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await until(() => listStarted);
    const previousReads = reads;
    await until(() => reads > previousReads);
    release();
    await page.getByLabel("3 mensagens nao lidas").waitFor({ state: "attached" });
    assert.equal(await page.locator(".inbox-unread").count(), 1, "Leitura mais recente nao revive badge nem descarta Bia");

    counts.c2 = 4;
    await page.evaluate(() => window.streams[0].onopen());
    await page.getByLabel("4 mensagens nao lidas").waitFor({ state: "attached" });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Aprovados desktop/mobile: badges sem SSE, lista atrasada concorrente com leitura e reconciliacao ao reconectar. APIs simuladas.");
} finally {
  await browser.close();
}
