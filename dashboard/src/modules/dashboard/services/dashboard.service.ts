import { buildApiUrl } from "../../../shared/config/api";
import { getJson } from "../../../shared/lib/http";
import type { DashboardSummary } from "../../../shared/types/dashboard";

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    return getJson<DashboardSummary>(buildApiUrl("/api/dashboard/summary"));
  },
};
