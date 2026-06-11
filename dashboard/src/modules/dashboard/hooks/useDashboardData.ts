// dashboard/src/modules/dashboard/hooks/useDashboardData.ts
import { useEffect, useState } from "react";
import type {
  DashboardQueueStats,
  DashboardSummary,
} from "../../../shared/types/dashboard";
import { dashboardService } from "../services/dashboard.service";

type State = {
  summary: DashboardSummary | null;
  queueStats: DashboardQueueStats | null;
  isLoading: boolean;
  error: string | null;
};

export function useDashboardData() {
  const [state, setState] = useState<State>({
    summary: null,
    queueStats: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      dashboardService.getSummary(),
      dashboardService.getQueueStats(),
    ])
      .then(([summary, queueStats]) => {
        if (isMounted) {
          setState({ summary, queueStats, isLoading: false, error: null });
        }
      })
      .catch(() => {
        if (isMounted) {
          setState({
            summary: null,
            queueStats: null,
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
