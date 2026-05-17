import { buildApiUrl } from "../../../shared/config/api";
import { getJson, postJson } from "../../../shared/lib/http";

export type PostEventItem = {
  id: number;
  postId: string;
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
  metaCollected?: number;
  fallbackCollected?: number;
  totalCandidates: number;
  mode: string;
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
};
