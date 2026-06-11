// dashboard/src/modules/dashboard/hooks/useDashboardData.ts
import { useEffect, useState } from "react";
import type {
  DashboardOperationalOverview,
  DashboardSummary,
} from "../../../shared/types/dashboard";
import { dashboardService } from "../services/dashboard.service";

type State = {
  summary: DashboardSummary | null;
  overview: DashboardOperationalOverview | null;
  isLoading: boolean;
  error: string | null;
};

export function useDashboardData() {
  const [state, setState] = useState<State>({
    summary: null,
    overview: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    dashboardService
      .getSummary()
      .then((summary) => {
        if (isMounted) {
          setState({ summary, overview: null, isLoading: false, error: null });
        }
      })
      .catch(() => {
        if (isMounted) {
          setState({
            summary: null,
            overview: null,
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
