// dashboard / src / modules / dashboard / services / dashboard.service.ts;
import { buildApiUrl } from "../../../shared/config/api";
import { getJson } from "../../../shared/lib/http";
import type {
  DashboardQueueStats,
  DashboardSummary,
  TopPostItem,
} from "../../../shared/types/dashboard";

export type TopPostsResponse = {
  source: string;
  sort: "likes" | "reach" | "views";
  items: TopPostItem[];
  total: number;
};

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    return getJson<DashboardSummary>(buildApiUrl("/api/dashboard/summary"));
  },

  async getQueueStats(): Promise<DashboardQueueStats> {
    return getJson<DashboardQueueStats>(
      buildApiUrl("/api/internal/queue/stats"),
    );
  },

  async getTopPosts(sort = "likes", limit = 10): Promise<TopPostsResponse> {
    const params = new URLSearchParams({
      sort,
      limit: String(limit),
    });

    return getJson<TopPostsResponse>(
      buildApiUrl(`/api/metrics/top-posts?${params.toString()}`),
    );
  },
};
