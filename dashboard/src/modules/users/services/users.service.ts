import { buildApiUrl } from "../../../shared/config/api";

export type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  role: "admin" | "operator";
  active: boolean;
  forcePasswordChange: boolean;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const csrfToken = sessionStorage.getItem("socialbot.admin.csrf");
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string };
      message = payload.message || message;
    } catch {
      // Mantém a mensagem HTTP.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const usersService = {
  list() {
    return request<{ items: AdminUser[]; total: number }>(
      "/api/internal/users",
    );
  },
  create(input: {
    username: string;
    displayName: string;
    email?: string;
    role: "admin" | "operator";
    password: string;
  }) {
    return request<AdminUser>("/api/internal/users", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  update(userId: string, input: {
    displayName: string;
    email?: string;
    role: "admin" | "operator";
    active: boolean;
  }) {
    return request<AdminUser>(`/api/internal/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  resetPassword(userId: string, password: string) {
    return request<void>(`/api/internal/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },
};
