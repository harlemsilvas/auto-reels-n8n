import { buildApiUrl } from "../../../shared/config/api";

export type MediaTemplateStatus = "draft" | "active" | "archived";
export type PublishType =
  | "reel"
  | "feed_image"
  | "feed_carousel"
  | "story_image"
  | "story_video";
export type TextVariantStatus = "generated" | "approved" | "rejected";

export type MediaTemplate = {
  id: string;
  workspaceId: string;
  tag: string;
  name: string;
  category: string;
  status: MediaTemplateStatus;
  brand: string | null;
  productName: string | null;
  baseDescription: string | null;
  targetAudience: string | null;
  allowedClaims: string[];
  forbiddenClaims: string[];
  defaultCta: string | null;
  baseHashtags: string[];
  notes: string | null;
  mediaItemsCount: number;
  textVariantsCount: number;
  createdByDisplayName?: string | null;
  approvedByDisplayName?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  mediaItems?: TemplateMediaItem[];
  textVariants?: TextVariant[];
};

export type TemplateMediaItem = {
  id: string;
  templateId: string;
  workspaceId: string;
  sortOrder: number;
  mediaKind: "image" | "video";
  role: string;
  storedFilename: string;
  originalFilename: string | null;
  storagePath: string;
  mimeType: string | null;
  fileSize: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  notes?: string | null;
  createdAt: string;
};

export type TextVariant = {
  id: string;
  templateId: string;
  workspaceId: string;
  publishType: PublishType;
  tone: string | null;
  objective: string | null;
  title: string | null;
  caption: string;
  hashtags: string[];
  cta: string | null;
  promptSent?: string | null;
  aiResponse?: string | null;
  status: TextVariantStatus;
  createdByDisplayName?: string | null;
  approvedByDisplayName?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTemplateInput = {
  tag: string;
  name: string;
  category?: string;
  status?: MediaTemplateStatus;
  brand?: string;
  productName?: string;
  baseDescription?: string;
  targetAudience?: string;
  allowedClaims?: string[];
  forbiddenClaims?: string[];
  defaultCta?: string;
  baseHashtags?: string[];
  notes?: string;
};

export type CreateTextVariantInput = {
  publishType: PublishType;
  tone?: string;
  objective?: string;
  title?: string;
  caption: string;
  hashtags?: string[];
  cta?: string;
  status?: TextVariantStatus;
};

export type GenerateTextVariantInput = {
  publishType?: PublishType;
  tone?: string;
  objective?: string;
  title?: string;
  cta?: string;
};

export type TemplatePost = {
  id: string;
  workspaceId: string;
  title: string | null;
  status: string;
  publishType: PublishType;
  mediaType: string | null;
  scheduledAt: string | null;
  mediaTemplateId: string;
  mediaTemplateTextVariantId: string;
  tag: string;
  mediaItemsCount: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const csrfToken = sessionStorage.getItem("socialbot.admin.csrf");
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body && !isFormData
        ? { "Content-Type": "application/json" }
        : {}),
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
      // Mantem a mensagem HTTP.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function searchParams(params: Record<string, string | number | undefined>) {
  const urlParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) {
      urlParams.set(key, String(value));
    }
  });

  const query = urlParams.toString();
  return query ? `?${query}` : "";
}

export const mediaTemplatesService = {
  list(params: {
    q?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    return request<{ items: MediaTemplate[]; total: number; limit: number; offset: number }>(
      `/api/media/templates${searchParams(params)}`,
    );
  },

  get(templateId: string) {
    return request<MediaTemplate>(`/api/media/templates/${templateId}`);
  },

  create(input: CreateTemplateInput) {
    return request<MediaTemplate>("/api/media/templates", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  approve(templateId: string) {
    return request<MediaTemplate>(`/api/media/templates/${templateId}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  archive(templateId: string) {
    return request<MediaTemplate>(`/api/media/templates/${templateId}`, {
      method: "DELETE",
    });
  },

  createTextVariant(templateId: string, input: CreateTextVariantInput) {
    return request<TextVariant>(
      `/api/media/templates/${templateId}/text-variants`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  generateTextVariant(templateId: string, input: GenerateTextVariantInput) {
    return request<TextVariant>(
      `/api/media/templates/${templateId}/text-variants/generate`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  approveTextVariant(templateId: string, variantId: string) {
    return request<TextVariant>(
      `/api/media/templates/${templateId}/text-variants/${variantId}/approve`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
  },

  rejectTextVariant(templateId: string, variantId: string) {
    return request<TextVariant>(
      `/api/media/templates/${templateId}/text-variants/${variantId}`,
      {
        method: "DELETE",
      },
    );
  },

  uploadMedia(templateId: string, input: {
    file: File;
    role?: string;
    sortOrder?: number;
    notes?: string;
  }) {
    const formData = new FormData();
    formData.append("file", input.file);
    if (input.role) formData.append("role", input.role);
    if (input.sortOrder !== undefined) {
      formData.append("sortOrder", String(input.sortOrder));
    }
    if (input.notes) formData.append("notes", input.notes);

    return request<TemplateMediaItem>(
      `/api/media/templates/${templateId}/media-upload`,
      {
        method: "POST",
        body: formData,
      },
    );
  },

  createPostFromTag(tag: string, input: {
    textVariantId?: string;
    publishType?: PublishType;
    title?: string;
    scheduledAt?: string;
  }) {
    return request<TemplatePost>(
      `/api/media/templates/by-tag/${encodeURIComponent(tag)}/posts`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
};
