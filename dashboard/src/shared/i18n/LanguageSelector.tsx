import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { changeLanguage, normalizeLanguage } from "./index";

export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  return (
    <label className="language-selector" title={t("language")}>
      <Languages size={17} aria-hidden="true" />
      <select aria-label={t("language")} value={normalizeLanguage(i18n.resolvedLanguage)}
        onChange={(event) => void changeLanguage(normalizeLanguage(event.target.value))}>
        <option value="pt-BR" lang="pt-BR">{"Portugu\u00eas"}</option>
        <option value="en" lang="en">English</option>
      </select>
    </label>
  );
}
