import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const template = { id: "t1", workspaceId: "w1", tag: "192xt", name: "192XT-Traseira", status: "active",
      baseDescription: "Pastilha traseira", baseHashtags: [], allowedClaims: [], forbiddenClaims: [],
      textVariantsCount: 0, mediaItemsCount: 0, textVariants: [], mediaItems: [], recentPosts: [],
      createdAt: "2026-10-11T10:00:00Z", updatedAt: "2026-10-11T10:00:00Z" };
    let rejectGemini = true;
    let failList = false;
    let generated = 0;
    let localCalls = 0;
    let release;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body = { items: [] };
      if (path === "/api/auth/status") body = { enabled: true };
      else if (path === "/api/auth/me") body = { user: { id: "admin", username: "admin", role: "admin", forcePasswordChange: false } };
      else if (path === "/api/auth/csrf") body = { csrfToken: "fake" };
      else if (path.endsWith("/text-variants/generate")) {
        const input = route.request().postDataJSON();
        assert.equal(input.allowLocalFallback, false);
        if (input.generationMode === "gemini" && rejectGemini) {
          await new Promise((resolve) => { release = resolve; });
          await route.fulfill({ status: 503, json: { message: "Nenhuma credencial Gemini ativa disponível para gerar texto." } });
          return;
        }
        if (input.generationMode === "local") localCalls++;
        generated++;
        body = { id: `v${generated}`, templateId: template.id, workspaceId: "w1", publishType: "feed_image",
          title: `Texto ${generated}`, caption: `Legenda ${input.generationMode} ${generated}`, hashtags: ["#Potenza"],
          status: "generated", createdAt: template.createdAt, updatedAt: template.updatedAt };
        template.textVariants.push(body);
        template.textVariantsCount++;
      } else if (path === "/api/media/templates") {
        if (failList) { failList = false; await route.fulfill({ status: 503, json: { message: "Lista indisponivel" } }); return; }
        body = { items: [template] };
      } else if (path === "/api/media/templates/t1") body = template;
      await route.fulfill({ json: body });
    });
    await page.goto("http://127.0.0.1:5181/modelos");
    const phase = page.locator("#modelos-textos");
    await phase.getByRole("button", { name: "Gerar com Gemini", exact: true }).click();
    await phase.getByRole("button", { name: "Gerando com Gemini...", exact: true }).waitFor();
    assert.ok(await phase.getByRole("button", { name: "Gerar sugestão local", exact: true }).isDisabled());
    while (!release) await page.waitForTimeout(20);
    release();
    await phase.getByRole("alert").waitFor();
    assert.match(await phase.getByRole("alert").innerText(), /Nenhuma credencial Gemini ativa/);
    assert.equal(await phase.getByRole("link", { name: "Configurar credencial Gemini" }).getAttribute("href"), "/ia/credenciais");
    assert.equal(localCalls, 0, "Erro Gemini nao vira geracao local silenciosa");
    assert.equal(generated, 0);
    await phase.screenshot({ path: `/tmp/modelos-gemini-error-${mobile ? "mobile" : "desktop"}.png` });

    await phase.getByRole("button", { name: "Gerar sugestão local", exact: true }).click();
    const review = page.getByRole("heading", { name: "Revisar variação", exact: true }).locator("..");
    await review.waitFor();
    assert.equal(await review.locator("textarea").first().inputValue(), "Legenda local 1");
    rejectGemini = false;
    await phase.getByRole("button", { name: "Gerar com Gemini", exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll("textarea")].some((input) => input.value === "Legenda gemini 2"));
    assert.equal(await review.locator("textarea").first().inputValue(), "Legenda gemini 2");
    failList = true;
    await phase.getByRole("button", { name: "Gerar com Gemini", exact: true }).click();
    await phase.getByRole("alert").waitFor();
    assert.match(await phase.getByRole("alert").innerText(), /Texto gerado e salvo/);
    assert.equal(generated, 3, "Falha no refresh nao repete geracao");
    assert.equal(await review.locator("textarea").first().inputValue(), "Legenda gemini 3");
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Aprovados desktop/mobile: Gemini indisponivel, progresso/erro na Fase 4, credenciais, sem fallback, revisao local/Gemini e refresh falhando sem duplicar. APIs simuladas.");
} finally {
  await browser.close();
}
