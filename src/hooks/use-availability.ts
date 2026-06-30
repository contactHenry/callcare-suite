import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Presence = "available" | "on_call" | "acw" | "break" | "training" | "meeting" | "offline";

export const PRESENCE_LABEL: Record<Presence, string> = {
  available: "Available",
  on_call: "On a Call",
  acw: "After-Call Work",
  break: "On Break",
  training: "In Training",
  meeting: "In a Meeting",
  offline: "Offline",
};

export const PRESENCE_COLOR: Record<Presence, string> = {
  available: "bg-emerald-500",
  on_call: "bg-rose-500",
  acw: "bg-amber-500",
  break: "bg-sky-500",
  training: "bg-violet-500",
  meeting: "bg-indigo-500",
  offline: "bg-slate-400",
};

/**
 * Live agent presence — reads & writes to `agent_availability`. Used by the
 * sidebar widget and visible to Team Leaders+ via realtime on the same table.
 */
export function useAvailability(userId: string | undefined) {
  const [status, setStatus] = useState<Presence>("offline");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const { data } = await supabase
          .from("agent_availability")
          .select("status")
          .eq("user_id", userId)
          .maybeSingle();
        if (!cancelled && data?.status) setStatus(data.status as Presence);
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const update = useCallback(async (next: Presence) => {
    if (!userId) return;
    setLoading(true);
    setStatus(next);
    try {
      await supabase.from("agent_availability").upsert({ user_id: userId, status: next });
    } catch {
      /* Availability is a convenience UI control; never crash navigation. */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { status, update, loading };
}