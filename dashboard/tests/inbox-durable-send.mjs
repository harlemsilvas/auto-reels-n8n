import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
const errors = [];
let active = null;
const attempts = new Map();
const history = [];
let sends = 0;
let repairs = 0;
let mode = "held";
let release;
const contexts = [];
async function client(mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  contexts.push(context);
  await context.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    let body = {};
    if (url.pathname === "/api/auth/status") body = { enabled: true };
    else if (url.pathname === "/api/auth/me") body = { user: { id: "admin", username: "admin", role: "admin", forcePasswordChange: false } };
    else if (url.pathname === "/api/auth/csrf") body = { csrfToken: "fake" };
    else if (url.pathname === "/api/internal/conversations") body = { items: [{ id: "c1", accountId: "a1", instagramUserId: "123", instagramUsername: "ana" }] };
    else if (url.pathname === "/api/internal/conversations/c1/messages") body = { items: [...history] };
    else if (url.pathname.endsWith("/read")) body = { ok: true, unreadCount: 0 };
    else if (url.pathname === "/api/internal/messages/send") {
      const input = request.postDataJSON();
      assert.match(input.requestId, /^[a-f0-9-]{36}$/);
      if (active) {
        await route.fulfill({ status: 502, json: { code: "MESSAGE_DELIVERY_UNCERTAIN", attempt: active } });
        return;
      }
      sends++;
      active = { id: input.requestId, conversationId: "c1", messageText: input.messageText,
        createdAt: "2026-10-12T10:00:00Z", state: "sending", metaMessageId: null };
      attempts.set(active.id, active);
      if (mode === "held") await new Promise(resolve => { release = resolve; });
      active.state = "uncertain";
      if (mode !== "unknown") active.metaMessageId = `meta-${sends}`;
      await route.fulfill({ status: 502, json: { code: "MESSAGE_DELIVERY_UNCERTAIN", attempt: active, metaMessageId: active.metaMessageId } });
      return;
    } else if (url.pathname === "/api/internal/messages/attempts/c1") {
      const attempt = attempts.get(url.searchParams.get("requestId")) ?? active;
      body = { attempt: attempt ?? null, message: attempt?.state === "sent" ? history.find(item => item.metaMessageId === attempt.metaMessageId) : null };
    } else if (url.pathname.endsWith("/reconcile")) {
      const attempt = attempts.get(request.postDataJSON().requestId);
      assert.ok(attempt?.metaMessageId, "Somente confirmacao Meta permite reparo local");
      repairs++;
      let saved = history.find(item => item.metaMessageId === attempt.metaMessageId);
      if (!saved) { saved = { id: `m-${sends}`, conversationId: "c1", sentBy: "bot", messageText: attempt.messageText,
        metaMessageId: attempt.metaMessageId, createdAt: attempt.createdAt }; history.push(saved); }
      attempt.state = "sent";
      if (active?.id === attempt.id) active = null;
      body = { attempt, message: saved };
    } else if (url.pathname.endsWith("/dismiss")) {
      const input = request.postDataJSON();
      assert.equal(input.acknowledged, true);
      const attempt = attempts.get(input.requestId);
      assert.equal(attempt.metaMessageId, null);
      attempt.state = "dismissed";
      active = null;
      body = { ok: true };
    }
    await route.fulfill({ json: body });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { window.initialPendingCount = Object.keys(sessionStorage).filter(key => key.startsWith("socialbot.inbox.pending.")).length; });
  await page.goto("http://localhost:5181/inbox");
  await page.getByRole("button", { name: /ana/ }).waitFor();
  if (mobile) await page.getByRole("button", { name: /ana/ }).click();
  return { page, context };
}
const enabled = page => page.waitForFunction(() => !document.querySelector('textarea[aria-label="Mensagem"]').disabled);
try {
  const sender = await client();
  const tab = await sender.context.newPage();
  tab.on("pageerror", error => errors.push(error.message));
  await tab.goto("http://localhost:5181/inbox");
  await tab.getByRole("button", { name: /ana/ }).waitFor();
  await tab.getByRole("textbox", { name: "Mensagem", exact: true }).fill("Rascunho ainda nao enviado");
  await sender.page.getByRole("textbox", { name: "Mensagem", exact: true }).fill("Uma unica entrega");
  await sender.page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  while (!release) await sender.page.waitForTimeout(20);
  await tab.getByRole("status").filter({ hasText: "Entrega incerta" }).waitFor();
  const device = await client(true);
  assert.equal(await device.page.evaluate(() => window.initialPendingCount), 0);
  await device.page.getByRole("status").filter({ hasText: "Entrega incerta" }).waitFor();
  assert.ok(await device.page.getByRole("button", { name: "Enviar mensagem", exact: true }).isDisabled());
  const blocked = await device.page.evaluate(async () => {
    const response = await fetch('http://localhost:3101/api/internal/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'c1', accountId: 'a1', recipientId: '123', messageText: 'Outra tentativa', requestId: crypto.randomUUID() }) });
    return response.status;
  });
  assert.equal(blocked, 502);
  assert.equal(sends, 1);
  mode = "confirmed";
  release();
  await Promise.all([enabled(sender.page), enabled(tab), enabled(device.page)]);
  assert.equal(sends, 1);
  assert.equal(history.length, 1);
  assert.equal(await tab.getByRole("textbox", { name: "Mensagem", exact: true }).inputValue(), "Rascunho ainda nao enviado");
  assert.ok(repairs >= 1);
  mode = "unknown";
  await sender.page.getByRole("textbox", { name: "Mensagem", exact: true }).fill("Resultado sem ID");
  await sender.page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await sender.page.getByRole("status").filter({ hasText: "Entrega incerta" }).waitFor();
  await sender.context.close();
  const fresh = await client(true);
  assert.equal(await fresh.page.evaluate(() => window.initialPendingCount), 0);
  await fresh.page.getByRole("status").filter({ hasText: "Entrega incerta" }).waitFor();
  await fresh.page.getByText("Resultado sem ID", { exact: true }).waitFor();
  assert.equal(sends, 2, "Novo dispositivo nao reenvia tentativa duravel");
  await fresh.page.screenshot({ path: "/tmp/inbox-durable-mobile.png" });
  fresh.page.once("dialog", dialog => dialog.accept());
  await fresh.page.getByRole("button", { name: "Encerrar tentativa apos conferir entrega" }).click();
  await enabled(fresh.page);
  await enabled(device.page);
  assert.equal(sends, 2, "Encerramento manual nao envia DM");
  assert.deepEqual(errors, []);
  console.log("Aprovados: bloqueio servidor em outra aba/dispositivo sem storage, ID estavel, recuperacao apos fechar aba, reparo sem Meta e encerramento compartilhado. APIs simuladas.");
} finally { await Promise.all(contexts.map(context => context.close().catch(() => {}))); await browser.close(); }
