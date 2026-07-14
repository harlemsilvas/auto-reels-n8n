import {
  Navigate,
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import InstagramInboxPage from "../../modules/inbox/pages/InstagramInboxPage";
import { ProtectedRoute } from "../guards/ProtectedRoute";
import { PasswordChangeGuard } from "../guards/PasswordChangeGuard";
import { PermissionRoute } from "../guards/PermissionRoute";
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
import { MediaTemplatesPage } from "../../modules/media-templates/pages/MediaTemplatesPage";

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
              { path: "/uploads", element: <UploadPage /> },
              { path: "/agendamentos", element: <SchedulePage /> },
              { path: "/inbox", element: <InstagramInboxPage /> },
              {
                element: <PermissionRoute permission="metrics.view" />,
                children: [
                  { path: "/dashboard", element: <DashboardPage /> },
                  { path: "/historico", element: <HistoryPage /> },
                  { path: "/reels/:id", element: <ReelDetailsPage /> },
                ],
              },
              {
                element: (
                  <PermissionRoute permission="inbox.manage_testers" />
                ),
                children: [
                  { path: "/inbox/testers-dm", element: <TestersDmPage /> },
                ],
              },
              {
                element: (
                  <PermissionRoute permission="schedule_slots.manage" />
                ),
                children: [
                  { path: "/horarios", element: <ScheduleSlotsPage /> },
                ],
              },
              {
                element: <PermissionRoute permission="accounts.manage" />,
                children: [
                  { path: "/contas", element: <AccountsPage /> },
                ],
              },
              {
                element: (
                  <PermissionRoute permission="media_templates.view" />
                ),
                children: [
                  { path: "/modelos", element: <MediaTemplatesPage /> },
                ],
              },
              {
                element: <PermissionRoute permission="users.manage" />,
                children: [
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
