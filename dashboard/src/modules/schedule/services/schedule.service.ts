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
  status: string;
  caption: string | null;
  errorMessage: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  metaMediaId: string | null;
  accountId: string | null;
  videoFile: string | null;
};

export type PostsResponse = {
  items: PostListItem[];
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
};
