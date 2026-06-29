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
    supabase
      .from("agent_availability")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled && data?.status) setStatus(data.status as Presence); });
    const ch = supabase
      .channel(`presence:${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "agent_availability", filter: `user_id=eq.${userId}` },
        (payload: any) => { if (payload?.new?.status) setStatus(payload.new.status); },
      ).subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [userId]);

  const update = useCallback(async (next: Presence) => {
    if (!userId) return;
    setLoading(true);
    setStatus(next);
    await supabase.from("agent_availability").upsert({ user_id: userId, status: next });
    setLoading(false);
  }, [userId]);

  return { status, update, loading };
}