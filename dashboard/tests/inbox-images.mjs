import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const sharp = require("../../backend/node_modules/sharp");
const png = await sharp({ create: { width: 320, height: 180, channels: 3, background: "#2293a8" } }).png().toBuffer();
const browser = await chromium.launch({ headless: true });
const timeout = setTimeout(() => { process.exitCode = 1; void browser.close(); }, 45000);
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.streams = [];
      window.EventSource = class extends EventTarget { constructor() { super(); window.streams.push(this); } close() { this.closed = true; } };
    });
    const messages = [{ id: "inbound", conversationId: "c1", sentBy: "user", createdAt: "2026-10-11T10:00:00Z",
      messageText: "Veja https://example.com/catalogo. javascript:alert(1) <script>bad</script>",
      payload: { message: { attachments: [{ type: "image", payload: { url: "https://cdn.example.test/received.png" } },
        { type: "image", payload: { url: "javascript:alert(1)" } }] } } }];
    let failImage = true;
    let uncertain = false;
    let imageCalls = 0;
    let textCalls = 0;
    await page.route("https://cdn.example.test/**", (route) => route.fulfill({ contentType: "image/png", body: png }));
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body = {};
      if (path === "/api/auth/status") body = { enabled: true };
      else if (path === "/api/auth/me") body = { user: { id: "admin", username: "admin", role: "admin", forcePasswordChange: false } };
      else if (path === "/api/auth/csrf") body = { csrfToken: "fake" };
      else if (path === "/api/internal/conversations") body = { items: [{ id: "c1", accountId: "a1", instagramUserId: "123", instagramUsername: "ana", unreadCount: 0 }] };
      else if (path.endsWith("/messages")) body = { items: [...messages] };
      else if (path.endsWith("/image")) { await route.fulfill({ contentType: "image/png", body: png }); return; }
      else if (path === "/api/internal/messages/send") {
        textCalls++;
        body = { id: "sent-text", conversationId: "c1", sentBy: "bot", messageText: "Texto enviado", createdAt: "2026-10-11T10:01:00Z" };
        messages.push(body);
      } else if (path.endsWith("/images")) {
        imageCalls++;
        assert.match(route.request().headers()["content-type"], /multipart\/form-data; boundary=/);
        assert.equal(route.request().headers()["x-csrf-token"], "fake");
        assert.ok(route.request().postDataBuffer().includes(Buffer.from("foto.png")));
        if (failImage || uncertain) {
          await route.fulfill({ status: uncertain ? 502 : 400, json: {
            code: uncertain ? "MESSAGE_DELIVERY_UNCERTAIN" : undefined,
            message: uncertain ? "Confira o Instagram antes de reenviar." : "Imagem recusada pela Meta",
          } });
          return;
        }
        body = { id: "sent-image", conversationId: "c1", sentBy: "bot", messageText: "[image]", createdAt: "2026-10-11T10:02:00Z",
          payload: { inboxImage: { filename: "private.png" } } };
        messages.push(body);
      }
      await route.fulfill({ json: body });
    });
    await page.goto("http://127.0.0.1:5181/inbox");
    await page.getByRole("button", { name: /ana/ }).waitFor();
    if (mobile) await page.getByRole("button", { name: /ana/ }).click();
    await page.getByRole("link", { name: "https://example.com/catalogo", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "https://example.com/catalogo", exact: true }).getAttribute("rel"), "noopener noreferrer");
    await page.waitForFunction(() => document.querySelector(".inbox-image-link img")?.naturalWidth === 320);
    assert.equal(await page.locator(".inbox-image-link").count(), 1);
    assert.equal(await page.locator(".inbox-message-text script").count(), 0);
    const fileInput = page.getByLabel("Selecionar imagem");
    await fileInput.setInputFiles({ name: "fake.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
    await page.getByRole("alert").filter({ hasText: "JPG ou PNG" }).waitFor();
    await fileInput.setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
    await page.getByAltText("Previa da imagem").waitFor();
    await page.getByRole("textbox", { name: "Mensagem", exact: true }).fill("Texto enviado");
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Imagem recusada" }).waitFor();
    assert.equal(await page.getByRole("textbox", { name: "Mensagem", exact: true }).inputValue(), "");
    assert.equal(await page.getByAltText("Previa da imagem").count(), 1);
    failImage = false;
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll(".inbox-image-link img").length === 2 &&
      [...document.querySelectorAll(".inbox-image-link img")].every((image) => image.naturalWidth === 320));
    assert.equal(textCalls, 1, "Retry de imagem nao repete texto");
    assert.equal(imageCalls, 2);
    assert.equal(await page.getByAltText("Previa da imagem").count(), 0);
    await page.evaluate(() => {
      window.streams.findLast((stream) => !stream.closed).dispatchEvent(new MessageEvent("new-message", { data: JSON.stringify({
        id: "sse-image", conversationId: "c1", sentBy: "user", messageText: "[attachment]", createdAt: "2026-10-11T10:03:00Z",
        payload: { message: { attachments: [{ type: "image", payload: { url: "https://cdn.example.test/live.png" } }] } },
      }) }));
    });
    await page.waitForFunction(() => document.querySelectorAll(".inbox-image-link img").length === 3);
    await page.screenshot({ path: `/tmp/inbox-images-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await fileInput.setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
    uncertain = true;
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Confira o Instagram" }).waitFor();
    assert.equal(await page.getByAltText("Previa da imagem").count(), 0, "Nao mantem reenvio facil em entrega incerta");
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Aprovados desktop/mobile: links seguros, imagem recebida/SSE, preview, multipart/CSRF, falha/retry sem duplicar texto, entrega incerta e layout sem overflow. APIs simuladas.");
} finally { clearTimeout(timeout); await browser.close(); }
