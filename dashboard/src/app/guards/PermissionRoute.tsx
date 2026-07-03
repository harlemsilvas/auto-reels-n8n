import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../modules/auth/context/AuthContext";

export function PermissionRoute({ permission }: { permission: string }) {
  const { can } = useAuth();

  if (!can(permission)) {
    return <Navigate to="/uploads" replace />;
  }

  return <Outlet />;
}
