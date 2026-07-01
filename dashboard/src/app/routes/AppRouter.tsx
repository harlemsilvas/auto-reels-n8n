import {
  Navigate,
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import InstagramInboxPage from "../../modules/inbox/pages/InstagramInboxPage";
import { ProtectedRoute } from "../guards/ProtectedRoute";
import { PasswordChangeGuard } from "../guards/PasswordChangeGuard";
import { AdminRoute } from "../guards/AdminRoute";
import { AppLayout } from "../layout/AppLayout";
import { LoginPage } from "../../modules/auth/pages/LoginPage";
import { DashboardPage } from "../../modules/dashboard/pages/DashboardPage";
import { AccountsPage } from "../../modules/accounts/pages/AccountsPage";
import { SchedulePage } from "../../modules/schedule/pages/SchedulePage";
import { ScheduleSlotsPage } from "../../modules/schedule/pages/ScheduleSlotsPage";
import { HistoryPage } from "../../modules/history/pages/HistoryPage";
import { ReelDetailsPage } from "../../modules/history/pages/ReelDetailsPage";
import { UploadPage } from "../../modules/upload/pages/UploadPage";
import TestersDmPage from "../../modules/inbox/pages/TestersDmPage";
import { ChangePasswordPage } from "../../modules/auth/pages/ChangePasswordPage";
import { UsersPage } from "../../modules/users/pages/UsersPage";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/change-password", element: <ChangePasswordPage /> },
      {
        element: <PasswordChangeGuard />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: "/", element: <Navigate to="/dashboard" replace /> },
              { path: "/dashboard", element: <DashboardPage /> },
              { path: "/uploads", element: <UploadPage /> },
              { path: "/agendamentos", element: <SchedulePage /> },
              { path: "/horarios", element: <ScheduleSlotsPage /> },
              { path: "/historico", element: <HistoryPage /> },
              { path: "/reels/:id", element: <ReelDetailsPage /> },
              { path: "/inbox", element: <InstagramInboxPage /> },
              { path: "/inbox/testers-dm", element: <TestersDmPage /> },
              {
                element: <AdminRoute />,
                children: [
                  { path: "/contas", element: <AccountsPage /> },
                  { path: "/usuarios", element: <UsersPage /> },
                ],
              },
            ],
          },
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
