import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useIdleLogout } from "@/hooks/use-idle-logout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // Phase 2 hardening: 15-minute idle auto sign-out across the whole app.
  useIdleLogout(15 * 60_000);
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}