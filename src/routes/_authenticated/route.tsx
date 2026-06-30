import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useIdleLogout } from "@/hooks/use-idle-logout";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  // Phase 2 hardening: 15-minute idle auto sign-out across the whole app.
  useIdleLogout(15 * 60_000);
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}