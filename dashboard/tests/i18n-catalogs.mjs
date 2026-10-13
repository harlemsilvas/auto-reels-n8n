import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInstance } from "i18next";

const resources = {};
for (const language of ["pt-BR", "en"]) {
  resources[language] = {};
  for (const namespace of ["common", "auth", "accounts", "inbox"]) {
    resources[language][namespace] = JSON.parse(await readFile(
      new URL(`../src/shared/i18n/locales/${language}/${namespace}.json`, import.meta.url), "utf8"));
  }
}
function flatten(value, prefix = "", result = {}) {
  for (const [key, item] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof item === "object" && item) flatten(item, full, result);
    else { assert.equal(typeof item, "string"); assert.ok(item.trim()); result[full] = item; }
  }
  return result;
}
for (const namespace of ["common", "auth", "accounts", "inbox"]) {
  const pt = flatten(resources["pt-BR"][namespace]);
  const en = flatten(resources.en[namespace]);
  assert.deepEqual(Object.keys(pt).sort(), Object.keys(en).sort(), "Catalog key parity");
  for (const key of Object.keys(pt)) {
    const variables = text => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map(match => match[1]).sort();
    assert.deepEqual(variables(pt[key]), variables(en[key]), `Interpolation parity: ${key}`);
  }
}
const instance = createInstance();
await instance.init({ resources, lng: "pt-BR", fallbackLng: "pt-BR", defaultNS: "common" });
assert.equal(instance.t("unread", { count: 1 }), "1 mensagem n\u00e3o lida");
assert.equal(instance.t("unread", { count: 2 }), "2 mensagens n\u00e3o lidas");
await instance.changeLanguage("en");
assert.equal(instance.t("unread", { count: 0 }), "0 unread messages");
assert.equal(instance.t("unread", { count: 1 }), "1 unread message");
assert.equal(instance.t("unread", { count: 2 }), "2 unread messages");
instance.removeResourceBundle("en", "auth");
assert.equal(instance.t("auth:username"), "Usu\u00e1rio", "Missing namespace falls back to Portuguese");
console.log("Aprovados: catalogos PT/EN, chaves/variaveis, plural e fallback. Sem servicos externos.");
