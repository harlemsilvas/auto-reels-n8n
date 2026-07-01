import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../modules/auth/context/AuthContext";

export function PasswordChangeGuard() {
  const { user } = useAuth();

  if (user?.forcePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
