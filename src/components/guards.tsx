import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGroups } from "../context/GroupContext";
import Spinner from "./Spinner";
import type { ReactNode } from "react";

export function RequireMember() {
  const { status } = useAuth();
  if (status === "loading") return <Spinner label="Loading..." />;
  // When there is no backend configured, allow read-only browsing.
  if (status === "member" || status === "unconfigured") return <Outlet />;
  return <Navigate to="/login" replace />;
}

// Gate for group-scoped pages: a member must be in (and have an active) group.
export function RequireGroup() {
  const { status } = useAuth();
  const { loading, activeGroupId } = useGroups();
  if (status === "unconfigured") return <Outlet />;
  if (loading) return <Spinner label="Loading groups..." />;
  if (!activeGroupId) return <Navigate to="/groups" replace />;
  return <Outlet />;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, status } = useAuth();
  if (status === "loading") return <Spinner />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
