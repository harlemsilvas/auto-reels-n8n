// dashboard / src / modules / dashboard / services / dashboard.service.ts;
import { buildApiUrl } from "../../../shared/config/api";
import { getJson } from "../../../shared/lib/http";
import type {
  DashboardQueueStats,
  DashboardSummary,
} from "../../../shared/types/dashboard";

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    return getJson<DashboardSummary>(buildApiUrl("/api/dashboard/summary"));
  },

  async getQueueStats(): Promise<DashboardQueueStats> {
    return getJson<DashboardQueueStats>(
      buildApiUrl("/api/internal/queue/stats"),
    );
  },
};
