import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const fixture = (id, name) => ({
      id, workspaceId: "workspace", tag: `campanha-${id}`, name, category: "product", status: "active",
      baseDescription: `Descricao ${name}`, baseHashtags: [`#${id}`], allowedClaims: [], forbiddenClaims: [],
      mediaItemsCount: 1, textVariantsCount: 0, createdAt: "2026-10-11T10:00:00Z", updatedAt: "2026-10-11T10:00:00Z",
      mediaItems: [{ id: `media-${id}`, templateId: id, sortOrder: 0, mediaKind: "image", role: "cover",
        storedFilename: `${id}.jpg`, originalFilename: `${id}.jpg`, fileSize: 1000 }], textVariants: [], recentPosts: [],
    });
    const a = fixture("380xt", "Potenza - 380XT");
    const b = fixture("192xt", "192XT-Traseira");
    const c = fixture("erro", "Modelo indisponivel");
    const templates = [a, c];
    let delayedId;
    let release;
    let detailStarted;
    let failC = true;
    let requestsA = 0;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body = { items: [] };
      if (path === "/api/auth/status") body = { enabled: true };
      else if (path === "/api/auth/me") body = { user: { id: "admin", username: "admin", role: "admin", forcePasswordChange: false } };
      else if (path === "/api/auth/csrf") body = { csrfToken: "fake" };
      else if (path === "/api/media/templates") {
        if (route.request().method() === "POST") {
          assert.equal(route.request().postDataJSON().name, b.name);
          templates.push(b);
          body = b;
        } else body = { items: [...templates], total: templates.length };
      } else if (path.startsWith("/api/media/templates/")) {
        const id = path.split("/").at(-1);
        if (id === a.id) requestsA++;
        if (id === c.id && failC) { await route.fulfill({ status: 503, json: { message: "Detalhes indisponiveis" } }); return; }
        body = templates.find((template) => template.id === id);
        if (id === delayedId) {
          delayedId = null;
          detailStarted = id;
          await new Promise((resolve) => { release = resolve; });
        }
      }
      await route.fulfill({ json: body });
    });
    const until = async (condition) => {
      const deadline = Date.now() + 5000;
      while (!condition()) {
        assert.ok(Date.now() < deadline, "Requisicao nao iniciou");
        await page.waitForTimeout(30);
      }
    };
    const details = page.locator("#modelos-detalhes");
    const open = async (name) => page.locator("#modelos-busca tbody tr").filter({ hasText: name }).getByRole("button", { name: "Abrir" }).click();
    await page.goto("http://127.0.0.1:5181/modelos");
    await details.getByText(a.name, { exact: true }).waitFor();
    const beforeCreate = requestsA;
    const form = page.getByRole("heading", { name: "Novo modelo", exact: true }).locator("..").locator("form");
    await form.getByPlaceholder("potenza-gt-forza-kawasaki").fill(b.tag);
    await form.getByLabel(/^Nome/).fill(b.name);
    delayedId = b.id;
    await form.getByRole("button", { name: "Criar modelo", exact: true }).click();
    await until(() => detailStarted === b.id);
    await details.getByRole("status").waitFor();
    assert.equal(await details.getByText(a.name, { exact: true }).count(), 0, "Nao exibe detalhes antigos enquanto carrega");
    release();
    await details.getByText(b.name, { exact: true }).waitFor();
    assert.equal(requestsA, beforeCreate, "Criacao nao recarrega o ID anterior");
    await details.getByText("192xt.jpg", { exact: true }).waitFor();

    delayedId = a.id;
    await open(a.name);
    await until(() => detailStarted === a.id);
    const releaseA = release;
    await open(b.name);
    await details.getByText(b.name, { exact: true }).waitFor();
    releaseA();
    await page.waitForTimeout(150);
    assert.equal(await details.getByText(a.name, { exact: true }).count(), 0, "Resposta antiga nao sobrescreve selecao");
    await details.screenshot({ path: `/tmp/modelos-selection-${mobile ? "mobile" : "desktop"}.png` });

    await open(c.name);
    await page.getByText("Detalhes indisponiveis", { exact: true }).waitFor();
    assert.equal(await details.locator(".stat-list").count(), 0, "Falha nao deixa o modelo anterior visivel");
    failC = false;
    await open(c.name);
    await details.getByText(c.name, { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Aprovados desktop/mobile: criacao, Fase 2/midias, troca rapida, resposta atrasada, falha e reabertura. APIs simuladas; sem posts reais.");
} finally {
  await browser.close();
}
