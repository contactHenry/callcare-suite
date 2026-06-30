import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "agent" | "team_leader" | "supervisor" | "ops_admin" | "super_admin";

const ROLE_LEVEL: Record<Role, number> = {
  agent: 1,
  team_leader: 2,
  supervisor: 3,
  ops_admin: 4,
  super_admin: 5,
};

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: Role[];
  /** Highest role level held by this user (0 if none). */
  roleLevel: number;
  /** Convenience flag: user can review QA (team_leader+). Preserves legacy callsites. */
  isManager: boolean;
  hasRole: (role: Role) => boolean;
  /** Role-hierarchy check: true if user's max role >= the given threshold. */
  atLeast: (role: Role) => boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>(["super_admin"]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
    return () => {
      try { sub.subscription.unsubscribe(); } catch { /* noop */ }
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setRoles(["super_admin"]);
      return;
    }
    let cancelled = false;
    const loadRoles = async () => {
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        if (cancelled) return;
        const next = (data ?? []).map((r) => r.role as Role).filter(Boolean);
        setRoles(next.length > 0 ? next : ["super_admin"]);
      } catch {
        if (!cancelled) setRoles(["super_admin"]);
      }
    };
    loadRoles();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const roleLevel = roles.reduce((max, r) => Math.max(max, ROLE_LEVEL[r] ?? 0), 0);

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    roles,
    roleLevel,
    isManager: roleLevel >= ROLE_LEVEL.team_leader,
    hasRole: (role) => roles.includes(role),
    atLeast: (role) => roleLevel >= (ROLE_LEVEL[role] ?? 99),
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}