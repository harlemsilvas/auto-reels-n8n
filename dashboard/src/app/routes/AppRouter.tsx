import {
  Navigate,
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { ProtectedRoute } from "../guards/ProtectedRoute";
import { AppLayout } from "../layout/AppLayout";
import { LoginPage } from "../../modules/auth/pages/LoginPage";
import { DashboardPage } from "../../modules/dashboard/pages/DashboardPage";
import { AccountsPage } from "../../modules/accounts/pages/AccountsPage";
import { SchedulePage } from "../../modules/schedule/pages/SchedulePage";
import { ScheduleSlotsPage } from "../../modules/schedule/pages/ScheduleSlotsPage";
import { HistoryPage } from "../../modules/history/pages/HistoryPage";
import { UploadPage } from "../../modules/upload/pages/UploadPage";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/uploads", element: <UploadPage /> },
          { path: "/contas", element: <AccountsPage /> },
          { path: "/agendamentos", element: <SchedulePage /> },
          { path: "/horarios", element: <ScheduleSlotsPage /> },
          { path: "/historico", element: <HistoryPage /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
