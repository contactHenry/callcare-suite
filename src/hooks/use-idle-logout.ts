import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Signs the user out after `timeoutMs` of inactivity (default 15 min).
 * Mounted once inside the authenticated layout — events are listened to on
 * the window so it covers the entire app shell.
 */
export function useIdleLogout(timeoutMs: number = 15 * 60_000) {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let signedOut = false;

    const logout = async () => {
      if (signedOut) return;
      signedOut = true;
      try {
        await supabase.auth.signOut();
      } catch {}
      toast.message("Signed out", {
        description: `You were inactive for ${Math.round(timeoutMs / 60000)} minutes.`,
      });
      navigate({ to: "/auth" });
    };

    const reset = () => {
      if (signedOut) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(logout, timeoutMs);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "visibilitychange"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutMs, navigate]);
}