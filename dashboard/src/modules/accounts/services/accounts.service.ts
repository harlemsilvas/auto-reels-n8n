import { buildApiUrl } from "../../../shared/config/api";
import { getJson } from "../../../shared/lib/http";

export type InstagramAccount = {
  id: string;
  workspaceId: string | null;
  nome: string;
  instagramId: string;
  pageId: string | null;
  ativo: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: InstagramAccount[];
  total: number;
};

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...init,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export const accountsService = {
  async list(): Promise<ListResponse> {
    return getJson<ListResponse>(buildApiUrl("/api/internal/accounts"));
  },

  async upsert(payload: {
    nome: string;
    instagramId: string;
    pageId?: string;
    accessToken: string;
    tokenExpiresAt?: string;
    ativo?: boolean;
  }): Promise<InstagramAccount> {
    return requestJson<InstagramAccount>(
      buildApiUrl("/api/internal/accounts"),
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async setActive(id: string, ativo: boolean): Promise<InstagramAccount> {
    return requestJson<InstagramAccount>(
      buildApiUrl(`/api/internal/accounts/${id}/active`),
      {
        method: "PATCH",
        body: JSON.stringify({ ativo }),
      },
    );
  },

  async bootstrapFromEnv(): Promise<{
    message: string;
    account: InstagramAccount;
  }> {
    return requestJson<{ message: string; account: InstagramAccount }>(
      buildApiUrl("/api/internal/accounts/bootstrap-env"),
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
  },
};
