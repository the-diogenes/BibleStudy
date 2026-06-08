import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "./Spinner";
import type { ReactNode } from "react";

export function RequireMember() {
  const { status } = useAuth();
  if (status === "loading") return <Spinner label="Loading..." />;
  // When there is no backend configured, allow read-only browsing.
  if (status === "member" || status === "unconfigured") return <Outlet />;
  return <Navigate to="/login" replace />;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, status } = useAuth();
  if (status === "loading") return <Spinner />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
