import { buildApiUrl } from "../../../shared/config/api";

export type AiProvider = "gemini";
export type AiCredentialStatus = "active" | "limited" | "expired" | "disabled";
export type AiTask =
  | "media_templates_text"
  | "inbox_reply"
  | "content_review"
  | "general_test";

export type AiOption = {
  value: string;
  label: string;
  description?: string;
  recommended?: boolean;
};

export type AiCredential = {
  id: string;
  workspaceId: string;
  provider: AiProvider;
  label: string;
  task: AiTask;
  model: string;
  apiKeyHint: string | null;
  status: AiCredentialStatus;
  priority: number;
  dailyLimit: number | null;
  minuteLimit: number | null;
  lastUsedAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdByDisplayName?: string | null;
  updatedByDisplayName?: string | null;
  disabledAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiCredentialsOptions = {
  providers: AiOption[];
  tasks: AiOption[];
  models: Record<string, AiOption[]>;
};

export type AiCredentialsList = AiCredentialsOptions & {
  items: AiCredential[];
};

export type CreateAiCredentialInput = {
  provider: AiProvider;
  label: string;
  task: AiTask;
  model: string;
  apiKey: string;
  status?: AiCredentialStatus;
  priority?: number;
  dailyLimit?: number | null;
  minuteLimit?: number | null;
};

export type UpdateAiCredentialInput = Partial<
  Omit<CreateAiCredentialInput, "apiKey"> & { apiKey?: string }
>;

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
      // Mantem mensagem HTTP.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const aiCredentialsService = {
  list() {
    return request<AiCredentialsList>("/api/ai/credentials");
  },

  options() {
    return request<AiCredentialsOptions>("/api/ai/credentials/options");
  },

  create(input: CreateAiCredentialInput) {
    return request<AiCredential>("/api/ai/credentials", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: UpdateAiCredentialInput) {
    return request<AiCredential>(`/api/ai/credentials/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  disable(id: string) {
    return request<AiCredential>(`/api/ai/credentials/${id}`, {
      method: "DELETE",
    });
  },
};
