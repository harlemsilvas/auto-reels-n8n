import i18n, { normalizeLanguage } from "./index";

// Locale changes presentation only; timestamps and the browser timezone are preserved.
export function formatDateTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return i18n.t("unavailable");
  return new Intl.DateTimeFormat(normalizeLanguage(i18n.resolvedLanguage), options).format(date);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  if (!Number.isFinite(value)) return i18n.t("unavailable");
  return new Intl.NumberFormat(normalizeLanguage(i18n.resolvedLanguage), options).format(value);
}
