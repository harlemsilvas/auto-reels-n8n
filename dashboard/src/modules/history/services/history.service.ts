import { buildApiUrl } from "../../../shared/config/api";
import { getJson, postJson } from "../../../shared/lib/http";

export type PostEventItem = {
  id: number;
  postId: string;
  videoFilename: string | null;
  caption: string | null;
  eventType: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type PostEventsResponse = {
  items: PostEventItem[];
  total: number;
};

export type MetricItem = {
  id: number;
  postId: string;
  accountId: string;
  metaMediaId: string | null;
  videoFilename: string | null;
  caption: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  reach: number;
  engagementRate: number;
  fetchedAt: string;
};

export type MetricsHistoryResponse = {
  source: string;
  items: MetricItem[];
  total: number;
};

export type CollectMetricsResponse = {
  source: string;
  collected: number;
  skipped: number;
  unchanged?: number;
  metaCollected?: number;
  fallbackCollected?: number;
  totalCandidates: number;
  mode: string;
};

export type PostMetricTimelineItem = {
  date: string;
  likes: number;
  views: number;
  reach: number;
};

export type ReelDetail = {
  post: {
    id: string;
    videoFilename: string | null;
    caption: string | null;
    publishedAt: string | null;
    metaMediaId: string | null;
    status: string;
    accountName: string | null;
    instagramId: string | null;
  };
  latestMetrics: Omit<
    MetricItem,
    "id" | "postId" | "accountId" | "metaMediaId" | "videoFilename" | "caption"
  > | null;
  delta: {
    likes: number;
    views: number;
    reach: number;
  };
  timeline: PostMetricTimelineItem[];
  events: Array<Omit<PostEventItem, "postId" | "videoFilename" | "caption">>;
};

function withLimit(path: string, limit: number) {
  return buildApiUrl(`${path}?limit=${limit}`);
}

export const historyService = {
  async getEvents(limit = 50): Promise<PostEventsResponse> {
    return getJson<PostEventsResponse>(
      withLimit("/api/internal/posts/events", limit),
    );
  },

  async getMetrics(limit = 50): Promise<MetricsHistoryResponse> {
    return getJson<MetricsHistoryResponse>(
      withLimit("/api/internal/metrics/history", limit),
    );
  },

  async collectMetrics(limit = 5): Promise<CollectMetricsResponse> {
    return postJson<CollectMetricsResponse>(
      buildApiUrl("/api/internal/metrics/collect"),
      { limit },
    );
  },

  async getReelDetail(postId: string): Promise<ReelDetail> {
    return getJson<ReelDetail>(buildApiUrl(`/api/history/post/${postId}`));
  },

  async getReelTimeline(
    postId: string,
    days?: number,
  ): Promise<PostMetricTimelineItem[]> {
    const params = new URLSearchParams();

    if (days) {
      params.set("days", String(days));
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";

    return getJson<PostMetricTimelineItem[]>(
      buildApiUrl(`/api/history/post/${postId}/timeline${suffix}`),
    );
  },
};
