import { buildApiUrl } from "../../../shared/config/api";

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  role: "admin" | "operator";
  permissions?: string[];
  forcePasswordChange: boolean;
};

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

export const authService = {
  getStatus() {
    return request<{ enabled: boolean }>("/api/auth/status");
  },

  login(input: { username: string; password: string }) {
    return request<{
      user: AuthUser;
      csrfToken: string;
      expiresAt: string;
    }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  getMe() {
    return request<{ user: AuthUser }>("/api/auth/me");
  },

  getCsrf() {
    return request<{ csrfToken: string }>("/api/auth/csrf");
  },

  async logout(csrfToken: string | null) {
    const response = await fetch(buildApiUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "include",
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined,
    });

    if (!response.ok && response.status !== 401) {
      throw new Error(await parseError(response));
    }
  },

  async changePassword(input: {
    currentPassword: string;
    newPassword: string;
  }) {
    const csrfToken = sessionStorage.getItem("socialbot.admin.csrf");
    const response = await fetch(buildApiUrl("/api/auth/change-password"), {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }
  },
};
