import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.DASHBOARD_TEST_URL || "http://localhost:5181";
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
    const page = await context.newPage();
    for (const [file, lang, title] of [
      ["privacy.html", "pt-BR", "Política de Privacidade"],
      ["privacy.en.html", "en", "Privacy Policy"],
      ["data-deletion.html", "pt-BR", "Exclusão de dados"],
      ["data-deletion.en.html", "en", "Data deletion"],
    ]) {
      assert.equal((await page.goto(`${base}/${file}`)).status(), 200);
      assert.equal(await page.locator("html").getAttribute("lang"), lang);
      assert.equal(await page.locator("h1").innerText(), title);
      assert.equal(await page.locator("script").count(), 0);
      assert.equal(await page.locator("form").count(), 0);
      assert.ok(await page.locator('a[href="mailto:exclusao@hrmmotos.com.br"]').count() > 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      if (width === 320 && file === "data-deletion.en.html")
        await page.screenshot({ path: "/tmp/socialbot-data-deletion-en-320.png", fullPage: true });
      await page.locator("nav a").filter({ hasText: lang === "en" ? "Português" : "English" }).click();
      assert.equal(await page.locator("html").getAttribute("lang"), lang === "en" ? "pt-BR" : "en");
      const policy = file.startsWith("privacy");
      const target = policy ? "data-deletion" : "privacy";
      await page.locator(`main > p a[href^="${target}"]`).click();
      assert.ok(new URL(page.url()).pathname.includes(target));
    }
    await context.close();
    const loginContext = await browser.newContext({ viewport: { width, height: 900 } });
    // All APIs are simulated; no password, session or external data is used.
    await loginContext.route("**/api/**", route => {
      const status = new URL(route.request().url()).pathname.endsWith("/me") ? 401 : 200;
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ enabled: true }) });
    });
    const login = await loginContext.newPage();
    await login.goto(`${base}/login`);
    for (const [lang, policyLabel, deletionLabel, suffix] of [
      ["pt-BR", "Política de Privacidade", "Exclusão de dados", ""],
      ["en", "Privacy Policy", "Data deletion", ".en"],
    ]) {
      await login.locator(".language-selector select").selectOption(lang);
      const policyLink = login.getByRole("link", { name: policyLabel, exact: true });
      const deletionLink = login.getByRole("link", { name: deletionLabel, exact: true });
      assert.equal(await policyLink.getAttribute("href"), `/privacy${suffix}.html`);
      assert.equal(await deletionLink.getAttribute("href"), `/data-deletion${suffix}.html`);
      await deletionLink.click();
      await login.waitForURL(`**/data-deletion${suffix}.html`);
      assert.equal(await login.locator("html").getAttribute("lang"), lang);
      await login.goto(`${base}/login`);
    }
    await loginContext.close();
  }
  console.log("Approved: anonymous PT/EN pages without JavaScript, language/cross-page navigation, contact, desktop/390/320 overflow and translated login links. APIs simulated.");
} finally { await browser.close(); }
