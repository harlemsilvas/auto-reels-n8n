import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../modules/auth/context/AuthContext";
import { useTranslation } from "react-i18next";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation("auth");

  if (isLoading) {
    return <div className="page-loading" role="status">{t("checkingSession")}</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
