import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let outcome = "rejected";
    let calls = 0;
    let releaseSuccess;
    let history = [];
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      let body = {};
      if (path === "/api/auth/status") body = { enabled: true };
      else if (path === "/api/auth/me") body = { user: { id: "admin", username: "admin", role: "admin", forcePasswordChange: false } };
      else if (path === "/api/auth/csrf") body = { csrfToken: "fake" };
      else if (path === "/api/internal/conversations") body = { items: [
        { id: "c1", accountId: "a1", instagramUserId: "123", instagramUsername: "ana" },
        { id: "c2", accountId: "a1", instagramUserId: "456", instagramUsername: "bia" },
      ] };
      else if (path.endsWith("/messages")) body = { items: path.includes("/c1/") ? history : [] };
      else if (path.endsWith("/read")) body = { ok: true, unreadCount: 0 };
      else if (path === "/api/internal/messages/send") {
        calls++;
        if (outcome === "held-success") {
          await new Promise(resolve => { releaseSuccess = resolve; });
          await route.fulfill({ status: 201, json: { id: "delayed", conversationId: "c1", sentBy: "bot", metaMessageId: "late-meta", messageText: "Envio atrasado", createdAt: "2026-10-12T10:00:00Z" } });
          return;
        }
        if (outcome === "network") { await route.abort("failed"); return; }
        await route.fulfill({ status: outcome === "rejected" ? 400 : 502, json: outcome === "rejected"
          ? { message: "Rejeitado" }
          : { code: "MESSAGE_DELIVERY_UNCERTAIN", message: "Entrega incerta", metaMessageId: "meta-1" } });
        return;
      }
      await route.fulfill({ json: body });
    });
    const open = async () => {
      await page.goto("http://localhost:5181/inbox");
      await page.getByRole("button", { name: /ana/ }).waitFor();
      if (mobile) await page.getByRole("button", { name: /ana/ }).click();
    };
    await open();
    const draft = page.getByRole("textbox", { name: "Mensagem", exact: true });
    await draft.fill("Texto a preservar");
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Rejeitado" }).waitFor();
    assert.equal(await draft.inputValue(), "Texto a preservar");
    assert.equal(await page.locator(".inbox-message-bubble").count(), 0);
    outcome = "uncertain";
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Entrega incerta" }).waitFor();
    assert.ok(await draft.isDisabled());
    assert.ok(await page.getByRole("button", { name: "Enviar mensagem", exact: true }).isDisabled());
    await page.getByText("Texto a preservar", { exact: true }).waitFor();
    assert.equal(calls, 2);
    await page.reload();
    if (mobile) await page.getByRole("button", { name: /ana/ }).click();
    await page.getByRole("status").filter({ hasText: "Entrega incerta" }).waitFor();
    assert.ok(await draft.isDisabled());
    assert.equal(calls, 2, "Reload nao reenvia");
    if (mobile) await page.getByRole("button", { name: "Voltar para conversas" }).click();
    await page.getByRole("button", { name: /bia/ }).click();
    await page.waitForFunction(() => !document.querySelector('textarea[aria-label="Mensagem"]').disabled);
    assert.ok(await draft.isEnabled());
    if (mobile) await page.getByRole("button", { name: "Voltar para conversas" }).click();
    await page.getByRole("button", { name: /ana/ }).click();
    await page.getByRole("status").filter({ hasText: "Entrega incerta" }).waitFor();
    history = [{ id: "saved-other", conversationId: "c1", sentBy: "bot", metaMessageId: "other", messageText: "Texto a preservar", createdAt: "2026-10-12T10:00:00Z" }];
    await page.waitForTimeout(5500);
    assert.ok(await draft.isDisabled(), "Texto igual com outro ID nao reconcilia");
    history = [{ ...history[0], id: "saved", metaMessageId: "meta-1" }];
    await page.waitForFunction(() => !document.querySelector('textarea[aria-label="Mensagem"]').disabled, { timeout: 10000 });
    assert.equal(await page.getByRole("status").filter({ hasText: "Entrega incerta" }).count(), 0);
    assert.equal(await page.locator(".inbox-message-bubble").count(), 1);
    assert.equal(calls, 2);
    outcome = "network";
    await draft.fill("Timeout sem ID");
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Entrega incerta" }).waitFor();
    assert.ok(await draft.isDisabled());
    await page.screenshot({ path: `/tmp/inbox-reconciliation-${mobile ? "mobile" : "desktop"}.png` });
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Encerrar tentativa apos conferir entrega" }).click();
    await page.waitForFunction(() => !document.querySelector('textarea[aria-label="Mensagem"]').disabled);
    assert.ok(await draft.isEnabled());
    assert.equal(await draft.inputValue(), "");
    assert.equal(calls, 3);
    outcome = "held-success";
    await draft.fill("Envio atrasado");
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    while (!releaseSuccess) await page.waitForTimeout(20);
    if (mobile) await page.getByRole("button", { name: "Voltar para conversas" }).click();
    await page.getByRole("button", { name: /bia/ }).click();
    if (mobile) await page.getByRole("button", { name: "Voltar para conversas" }).click();
    await page.getByRole("button", { name: /ana/ }).click();
    await page.getByRole("status").filter({ hasText: "Entrega incerta" }).waitFor();
    releaseSuccess();
    await page.getByText("Envio atrasado", { exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('textarea[aria-label="Mensagem"]').disabled);
    assert.equal(await page.getByRole("status").filter({ hasText: "Entrega incerta" }).count(), 0);
    assert.equal(calls, 4, "Retorno tardio confirma tentativa sem repetir envio");
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Aprovados desktop/mobile: rejeicao conserva rascunho, incerto bloqueia/reload/escopo, IDs exatos reconciliam sem reenvio, falha de rede e descarte manual. APIs simuladas.");
} finally { await browser.close(); }
