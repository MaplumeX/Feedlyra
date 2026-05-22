import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/stores/auth";

export function ProtectedRoute() {
  const { accessToken } = useAuthStore();
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
