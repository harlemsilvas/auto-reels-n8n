import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      timezoneId: "America/Sao_Paulo",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const template = {
      id: "t174", workspaceId: "w1", tag: "174gt", name: "Potenza - 174GT", status: "active",
      baseHashtags: [], allowedClaims: [], forbiddenClaims: [], mediaItemsCount: 1, textVariantsCount: 1,
      createdAt: "2026-10-11T10:00:00Z", updatedAt: "2026-10-11T10:00:00Z", recentPosts: [],
      mediaItems: [{ id: "m1", templateId: "t174", sortOrder: 0, mediaKind: "image", role: "cover",
        storedFilename: "174gt.jpg", originalFilename: "174gt.jpg", fileSize: 1000 }],
      textVariants: [{ id: "v1", templateId: "t174", workspaceId: "w1", publishType: "feed_image",
        title: "174GT aprovado", caption: "Legenda 174GT", hashtags: [], status: "approved" }],
    };
    let outcome = "scheduled";
    let calls = 0;
    let release;
    let input;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body = { items: [] };
      if (path === "/api/auth/status") body = { enabled: true };
      else if (path === "/api/auth/me") body = { user: { id: "admin", username: "admin", role: "admin", forcePasswordChange: false } };
      else if (path === "/api/auth/csrf") body = { csrfToken: "fake" };
      else if (path === "/api/media/templates") body = { items: [template] };
      else if (path === "/api/media/templates/t174") body = template;
      else if (path === "/api/media/templates/by-tag/174gt/posts") {
        calls++;
        input = route.request().postDataJSON();
        if (calls === 1) await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 10000);
          release = () => { clearTimeout(timeout); resolve(); };
        });
        if (outcome === "error") {
          await route.fulfill({ status: 503, json: { message: "Agendamento indisponível" } });
          return;
        }
        body = { id: "a38b9d72-fd1e-48e0-a53b-6046f234c183", workspaceId: "w1", title: input.title,
          status: outcome, publishType: "feed_image", mediaType: "image", tag: "174gt", mediaItemsCount: 1,
          mediaTemplateId: "t174", mediaTemplateTextVariantId: "v1",
          scheduledAt: outcome === "scheduled" ? "2099-10-12T17:30:00Z" : null };
      } else if (route.request().method() !== "GET") {
        throw new Error(`Mutacao inesperada: ${path}`);
      }
      await route.fulfill({ json: body });
    });
    await page.goto("http://127.0.0.1:5181/modelos");
    const phase = page.locator("#modelos-post");
    const title = phase.getByLabel("Título da postagem", { exact: true });
    const date = phase.getByLabel("Dia do agendamento (opcional)", { exact: true });
    const slot = phase.getByLabel(/^Horário fixo/);
    await title.fill("174GT agendado");
    await date.fill("2099-10-12");
    await slot.selectOption("14:30");
    await phase.getByRole("button", { name: "Confirmar criação da postagem", exact: true }).click();
    await phase.getByRole("button", { name: "Confirmando postagem...", exact: true }).waitFor();
    assert.ok(await phase.getByRole("button", { name: "Confirmando postagem...", exact: true }).isDisabled());
    await phase.locator("form").evaluate((form) => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    assert.equal(calls, 1, "Submit repetido nao duplica POST");
    assert.equal(input.scheduledAt, "2099-10-12T14:30:00");
    release();
    await phase.getByText("Agendamento confirmado!", { exact: true }).waitFor();
    const feedback = phase.getByRole("status");
    assert.match(await feedback.innerText(), /174GT agendado/);
    assert.match(await feedback.innerText(), /12\/10\/2099, 14:30/);
    assert.match(await feedback.innerText(), /a38b9d72-fd1e-48e0-a53b-6046f234c183/);
    assert.equal(await feedback.getByRole("link", { name: "Abrir Agenda" }).getAttribute("href"), "/agendamentos");
    assert.equal(await phase.locator("form").count(), 0, "Sucesso substitui formulario para nao mostrar previa pendente");
    await feedback.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/modelos-scheduling-${mobile ? "mobile" : "desktop"}.png` });
    const fits = await feedback.evaluate((node) => node.scrollWidth <= node.clientWidth);
    assert.ok(fits, "Confirmacao e ID cabem no painel");

    outcome = "error";
    await phase.getByRole("button", { name: "Criar outra postagem", exact: true }).click();
    assert.equal(await date.inputValue(), "");
    await title.fill("174GT manter em falha");
    await date.fill("2099-10-12");
    await slot.selectOption("14:30");
    await phase.getByRole("button", { name: "Confirmar criação da postagem", exact: true }).click();
    await phase.getByRole("alert").waitFor();
    assert.match(await phase.getByRole("alert").innerText(), /Agendamento indisponível/);
    assert.equal(await phase.getByRole("status").count(), 0);
    assert.equal(await title.inputValue(), "174GT manter em falha");
    assert.equal(await date.inputValue(), "2099-10-12");
    assert.equal(await slot.inputValue(), "14:30");

    outcome = "pending";
    await phase.getByRole("button", { name: "Confirmar criação da postagem", exact: true }).click();
    await phase.getByText("Postagem criada!", { exact: true }).waitFor();
    assert.match(await phase.getByRole("status").innerText(), /Status: Pendente/);
    assert.doesNotMatch(await phase.getByRole("status").innerText(), /Agendado para|Agendamento confirmado/);
    assert.equal(calls, 3);
    assert.deepEqual(errors, []);
    await phase.getByRole("link", { name: "Abrir Agenda" }).click();
    await page.waitForURL("**/agendamentos");
    await page.close();
  }
  console.log("Aprovados desktop/mobile: confirmacao na Fase 5, data retornada, ID/link Agenda, submit duplicado, erro preservando formulario e status pendente. APIs simuladas; sem posts reais.");
} finally {
  await browser.close();
}
