import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { listMyGroups } from "../lib/db";
import type { Group, GroupMembership, GroupRole } from "../types";

interface GroupValue {
  loading: boolean;
  groups: GroupMembership[];
  activeGroupId: string | null;
  activeGroup: Group | null;
  activeRole: GroupRole | null;
  isGroupAdmin: boolean;
  setActiveGroup: (id: string) => void;
  refresh: () => Promise<void>;
}

const GroupContext = createContext<GroupValue | undefined>(undefined);

const ACTIVE_KEY = "bs:activeGroup";

export function GroupProvider({ children }: { children: ReactNode }) {
  const { status, profile } = useAuth();
  const [groups, setGroups] = useState<GroupMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY)
  );

  const refresh = useCallback(async () => {
    if (status !== "member" || !profile) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const mine = await listMyGroups(profile.id);
      setGroups(mine);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [status, profile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the active selection valid: fall back to the first group we belong to.
  useEffect(() => {
    if (loading) return;
    const ids = groups.map((g) => g.group.id);
    if (activeGroupId && ids.includes(activeGroupId)) return;
    const next = ids[0] ?? null;
    setActiveGroupId(next);
    if (next) localStorage.setItem(ACTIVE_KEY, next);
    else localStorage.removeItem(ACTIVE_KEY);
  }, [groups, loading, activeGroupId]);

  const setActiveGroup = useCallback((id: string) => {
    setActiveGroupId(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }, []);

  const active = useMemo(
    () => groups.find((g) => g.group.id === activeGroupId) || null,
    [groups, activeGroupId]
  );

  const value: GroupValue = {
    loading,
    groups,
    activeGroupId,
    activeGroup: active?.group ?? null,
    activeRole: active?.role ?? null,
    isGroupAdmin: active?.role === "admin",
    setActiveGroup,
    refresh,
  };

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroups(): GroupValue {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroups must be used within GroupProvider");
  return ctx;
}
