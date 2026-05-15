import { useEffect, useState } from "react";
import type { DashboardSummary } from "../../../shared/types/dashboard";
import { dashboardService } from "../services/dashboard.service";

type State = {
  data: DashboardSummary | null;
  isLoading: boolean;
  error: string | null;
};

export function useDashboardData() {
  const [state, setState] = useState<State>({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    dashboardService
      .getSummary()
      .then((data) => {
        if (isMounted) {
          setState({ data, isLoading: false, error: null });
        }
      })
      .catch(() => {
        if (isMounted) {
          setState({
            data: null,
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
