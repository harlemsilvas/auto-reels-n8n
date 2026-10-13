import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptCommon from "./locales/pt-BR/common.json";
import ptAuth from "./locales/pt-BR/auth.json";
import enCommon from "./locales/en/common.json";
import enAuth from "./locales/en/auth.json";
import ptAccounts from "./locales/pt-BR/accounts.json";
import enAccounts from "./locales/en/accounts.json";
import ptInbox from "./locales/pt-BR/inbox.json";
import enInbox from "./locales/en/inbox.json";

export type AppLanguage = "pt-BR" | "en";
export const LANGUAGE_STORAGE_KEY = "socialbot.language";
export const resources = {
  "pt-BR": { common: ptCommon, auth: ptAuth, accounts: ptAccounts, inbox: ptInbox },
  en: { common: enCommon, auth: enAuth, accounts: enAccounts, inbox: enInbox },
};

export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  return value === "en" ? "en" : "pt-BR";
}

function initialLanguage(): AppLanguage {
  try { return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY)); }
  catch { return "pt-BR"; }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: "pt-BR",
  supportedLngs: ["pt-BR", "en"],
  load: "currentOnly",
  defaultNS: "common",
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function updateDocument() {
  document.documentElement.lang = normalizeLanguage(i18n.resolvedLanguage);
  document.title = i18n.t("pageTitle");
}

i18n.on("languageChanged", updateDocument);
updateDocument();

export async function changeLanguage(language: AppLanguage) {
  await i18n.changeLanguage(normalizeLanguage(language));
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language)); }
  catch { /* Language still works in memory when browser storage is unavailable. */ }
}

window.addEventListener("storage", (event) => {
  if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) {
    void i18n.changeLanguage(normalizeLanguage(event.newValue));
  }
});

export default i18n;
