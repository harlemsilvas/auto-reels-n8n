// dashboard/src/modules/dashboard/hooks/useDashboardData.ts
import { useEffect, useState } from "react";
import type {
  DashboardQueueStats,
  DashboardSummary,
  TopPostItem,
} from "../../../shared/types/dashboard";
import { dashboardService } from "../services/dashboard.service";

type State = {
  summary: DashboardSummary | null;
  queueStats: DashboardQueueStats | null;
  topPosts: TopPostItem[];
  isLoading: boolean;
  error: string | null;
};

export function useDashboardData() {
  const [state, setState] = useState<State>({
    summary: null,
    queueStats: null,
    topPosts: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      dashboardService.getSummary(),
      dashboardService.getQueueStats(),
      dashboardService.getTopPosts("likes", 10),
    ])
      .then(([summary, queueStats, topPosts]) => {
        if (isMounted) {
          setState({
            summary,
            queueStats,
            topPosts: topPosts.items,
            isLoading: false,
            error: null,
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setState({
            summary: null,
            queueStats: null,
            topPosts: [],
            isLoading: false,
            error: "Falha ao carregar dashboard.",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
