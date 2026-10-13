import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
const timeout = setTimeout(() => {
  console.error("Inbox reliability test timed out.");
  process.exitCode = 1;
  void browser.close();
}, 40000);
const conversations = [
  { id: "c1", accountId: "a1", instagramUserId: "123", instagramUsername: "ana" },
  { id: "c2", accountId: "a1", instagramUserId: "456", instagramUsername: "bia" },
];
const message = (id, conversationId, text) => ({ id, conversationId, sentBy: "user", messageText: text, createdAt: "2026-10-11T10:00:00Z" });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.testStreams = [];
    window.EventSource = class extends EventTarget {
      constructor() { super(); window.testStreams.push(this); }
      close() { this.closed = true; }
    };
  });
  let releaseFirst;
  let firstStarted = false;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  let failSend = true;
  let sendCalls = 0;
  let holdPoll = false;
  let pollStarted = false;
  let releasePoll;
  const pollGate = new Promise((resolve) => { releasePoll = resolve; });
  let holdSend = false;
  let releaseSend;
  const sendGate = new Promise((resolve) => { releaseSend = resolve; });
  let sent = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body = {};
    if (path === "/api/auth/status") body = { enabled: true };
    else if (path === "/api/auth/me") body = { user: { id: "admin", username: "admin", displayName: "Teste", role: "admin", forcePasswordChange: false } };
    else if (path === "/api/auth/csrf") body = { csrfToken: "fake" };
    else if (path === "/api/internal/conversations") body = { items: conversations, total: 2 };
    else if (path === "/api/internal/conversations/c1/messages") {
      if (!firstStarted) { firstStarted = true; await firstGate; }
      body = { items: [message("m1", "c1", "Texto exclusivo de Ana")] };
    } else if (path === "/api/internal/conversations/c2/messages") {
      if (holdPoll) { holdPoll = false; pollStarted = true; await pollGate; }
      body = { items: [message("m2", "c2", "Texto exclusivo de Bia")] };
    } else if (path === "/api/internal/messages/send") {
      sendCalls++;
      if (failSend) { await route.fulfill({ status: 400, json: { message: "Falha simulada de envio" } }); return; }
      if (holdSend) { sent = true; await sendGate; }
      body = { ...message("sent1", "c2", "Resposta de Bia enviada"), sentBy: "bot" };
    }
    await route.fulfill({ json: body });
  });
  await page.goto("http://127.0.0.1:5181/inbox");
  await page.getByRole("button", { name: /bia/ }).waitFor();
  while (!firstStarted) await page.waitForTimeout(20);
  await page.getByRole("button", { name: /bia/ }).click();
  await page.getByText("Texto exclusivo de Bia", { exact: true }).waitFor();
  releaseFirst();
  await page.waitForTimeout(150);
  assert.equal(await page.getByText("Texto exclusivo de Ana", { exact: true }).count(), 0);
  const streamCount = await page.evaluate(() => window.testStreams.length);
  const input = page.getByRole("textbox", { name: "Mensagem", exact: true });
  await input.fill("Rascunho que deve permanecer");
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Falha ao enviar mensagem" }).waitFor();
  assert.equal(await input.inputValue(), "Rascunho que deve permanecer");
  assert.equal(await page.locator(".inbox-message-bubble").count(), 1);
  assert.equal(await page.evaluate(() => window.testStreams.length), streamCount);
  holdPoll = true;
  while (!pollStarted) await page.waitForTimeout(50);
  await page.evaluate((payload) => {
    const stream = window.testStreams.findLast((item) => !item.closed);
    stream.dispatchEvent(new MessageEvent("new-message", { data: JSON.stringify(payload) }));
    stream.dispatchEvent(new MessageEvent("new-message", { data: JSON.stringify(payload) }));
  }, message("sse1", "c2", "Evento SSE recebido durante polling"));
  releasePoll();
  await page.getByText("Evento SSE recebido durante polling", { exact: true }).waitFor();
  await page.waitForTimeout(150);
  assert.equal(await page.getByText("Evento SSE recebido durante polling", { exact: true }).count(), 1);
  assert.equal(await page.evaluate(() => window.testStreams.length), streamCount);
  failSend = false;
  holdSend = true;
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  while (!sent) await page.waitForTimeout(20);
  await page.getByRole("button", { name: /ana/ }).click();
  await page.getByText("Texto exclusivo de Ana", { exact: true }).waitFor();
  releaseSend();
  await page.waitForTimeout(150);
  assert.equal(await page.getByText("Resposta de Bia enviada", { exact: true }).count(), 0);
  assert.equal(sendCalls, 2);
  assert.deepEqual(errors, []);
  console.log("Aprovados: resposta atrasada, rascunho em falha, SSE sem reconexao/duplicacao, polling concorrente e envio em outra conversa. APIs simuladas.");
} finally {
  clearTimeout(timeout);
  await browser.close();
}
