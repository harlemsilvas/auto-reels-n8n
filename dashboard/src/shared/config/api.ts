export function getApiBaseUrl() {
  const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();

  if (!apiBaseUrl) {
    throw new Error(
      "VITE_API_BASE_URL nao configurada. Defina a URL da API no ambiente do dashboard.",
    );
  }

  return apiBaseUrl.replace(/\/$/, "");
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
