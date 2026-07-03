import { buildApiUrl } from "../../../shared/config/api";
import { getJson, postJson } from "../../../shared/lib/http";

export type QueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};

export type SchedulerJobResult = {
  postId: string;
  queued: boolean;
  jobId?: string;
  reason?: string;
};

export type EnqueueReadyResponse = {
  totalReady: number;
  queuedCount: number;
  skippedCount: number;
  jobs: SchedulerJobResult[];
};

export type PostListItem = {
  id: string;
  title: string | null;
  status: string;
  caption: string | null;
  errorMessage: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  createdByUserId: string | null;
  createdByUsername: string | null;
  createdByDisplayName: string | null;
  updatedAt: string;
  retryCount: number;
  metaMediaId: string | null;
  accountId: string | null;
  workspaceId: string | null;
  publishType: "reel" | "feed_image" | "feed_carousel" | "story_image" | "story_video";
  mediaType: "image" | "video" | "carousel" | null;
  mediaFile: string | null;
  mediaItemsCount: number;
  videoFile: string | null;
};

export type PostsResponse = {
  items: PostListItem[];
  total: number;
};

export type ScheduleTimeSlot = {
  id: number;
  label: string;
  timeValue: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleSlotsResponse = {
  items: ScheduleTimeSlot[];
  total: number;
};

function buildPostsUrl(limit: number, statusFilter: string) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));

  if (statusFilter !== "all") {
    params.set("status", statusFilter);
  }

  return buildApiUrl(`/api/internal/posts?${params.toString()}`);
}

export const scheduleService = {
  async getQueueStats(): Promise<QueueStats> {
    return getJson<QueueStats>(buildApiUrl("/api/internal/scheduler/stats"));
  },

  async getPosts(limit = 50, statusFilter = "all"): Promise<PostsResponse> {
    return getJson<PostsResponse>(buildPostsUrl(limit, statusFilter));
  },

  async getLatestPublishedPost(): Promise<PostListItem | null> {
    const data = await this.getPosts(1, "published");
    return data.items[0] ?? null;
  },

  async enqueueReady(): Promise<EnqueueReadyResponse> {
    return postJson<EnqueueReadyResponse>(
      buildApiUrl("/api/internal/scheduler/enqueue-ready"),
      {},
    );
  },

  async enqueueOne(postId: string): Promise<SchedulerJobResult> {
    return postJson<SchedulerJobResult>(
      buildApiUrl(`/api/internal/scheduler/enqueue/${postId}`),
      {},
    );
  },

  async cancelPost(postId: string): Promise<{ id: string; status: string }> {
    return postJson<{ id: string; status: string }>(
      buildApiUrl(`/api/internal/posts/${postId}/cancel`),
      {},
    );
  },

  async publishNow(
    postId: string,
  ): Promise<{
    success: boolean;
    queued: boolean;
    jobId?: string;
    reason?: string;
  }> {
    return postJson(
      buildApiUrl(`/api/internal/posts/${postId}/publish-now`),
      {},
    );
  },

  async getSlots(onlyEnabled = false): Promise<ScheduleSlotsResponse> {
    return getJson<ScheduleSlotsResponse>(
      buildApiUrl(`/api/internal/scheduler/slots?onlyEnabled=${onlyEnabled}`),
    );
  },

  async createSlot(payload: {
    label: string;
    timeValue: string;
    enabled?: boolean;
    sortOrder?: number;
  }): Promise<ScheduleTimeSlot> {
    return postJson<ScheduleTimeSlot>(
      buildApiUrl("/api/internal/scheduler/slots"),
      payload,
    );
  },

  async updateSlot(
    slotId: number,
    payload: Partial<{
      label: string;
      timeValue: string;
      enabled: boolean;
      sortOrder: number;
    }>,
  ): Promise<ScheduleTimeSlot> {
    return postJson<ScheduleTimeSlot>(
      buildApiUrl(`/api/internal/scheduler/slots/${slotId}`),
      payload,
    );
  },

  async deleteSlot(slotId: number): Promise<{ success: boolean }> {
    const csrfToken = sessionStorage.getItem("socialbot.admin.csrf");
    const response = await fetch(
      buildApiUrl(`/api/internal/scheduler/slots/${slotId}`),
      {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as { success: boolean };
  },
};
