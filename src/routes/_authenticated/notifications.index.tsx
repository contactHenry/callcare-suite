import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCStatusPill, CCWidget, CCCheckbox } from "@/components/cc";
import { DUMMY_NOTIFICATIONS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/notifications/")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showPrefs, setShowPrefs] = useState(false);

  const list = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await supabase
        .from("notifications" as any)
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null)
        .eq("user_id", user!.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("notifications" as any)
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const apiItems: any[] = (list.data ?? []) as any[];
  const items: any[] = apiItems.length > 0 ? apiItems : DUMMY_NOTIFICATIONS;
  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Alerts for assignments, complaints, missed follow-ups, compliance flags, and more."
        actions={
          <div className="flex gap-2">
            <CCButton size="sm" variant="ghost" onClick={() => setShowPrefs((v) => !v)}>
              {showPrefs ? "Hide preferences" : "Channel preferences"}
            </CCButton>
            {unreadCount > 0 && (
              <CCButton size="sm" variant="secondary" onClick={() => markAll.mutate()}>
                Mark all read ({unreadCount})
              </CCButton>
            )}
          </div>
        }
      />
      <div className="p-6 space-y-4">
        {showPrefs && <ChannelPreferences />}
        <CCWidget title={`Inbox · ${items.length}`}>
          <ul className="divide-y divide-[color:var(--cc-ink-100)]">
            {items.map((n) => {
              const tone: any =
                n.severity === "danger" ? "danger" :
                n.severity === "warning" ? "warning" :
                n.severity === "success" ? "success" : "info";
              return (
                <li key={n.id} className={`py-3 flex items-start gap-3 ${!n.read_at ? "bg-[color:var(--cc-brand-600)]/5 -mx-2 px-2 rounded-md" : ""}`}>
                  <div className="pt-1">
                    <CCStatusPill tone={tone} dot>{n.kind?.replace(/_/g, " ")}</CCStatusPill>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[color:var(--cc-ink-900)]">{n.title}</div>
                    {n.body && <div className="text-xs text-[color:var(--cc-ink-500)] mt-0.5 line-clamp-2">{n.body}</div>}
                    <div className="text-[11px] text-[color:var(--cc-ink-400)] mt-1 tabular-nums">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                  {!n.read_at && (
                    <CCButton size="sm" variant="ghost" onClick={() => markOne.mutate(n.id)}>Mark read</CCButton>
                  )}
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="py-8 text-sm text-center text-[color:var(--cc-ink-500)]">You're all caught up.</li>
            )}
          </ul>
        </CCWidget>
      </div>
    </>
  );
}

const NOTIFICATION_KINDS: { kind: string; label: string }[] = [
  { kind: "client_assigned", label: "New client assigned" },
  { kind: "follow_up_due", label: "Follow-up due / overdue" },
  { kind: "missed_call", label: "Missed incoming call" },
  { kind: "review_completed", label: "Call review completed" },
  { kind: "supervisor_feedback", label: "Supervisor feedback received" },
  { kind: "complaint_assigned", label: "Complaint assigned / overdue" },
  { kind: "campaign_target", label: "Campaign target reached" },
  { kind: "agent_inactive", label: "Agent inactivity" },
  { kind: "failed_login", label: "Failed login detected" },
  { kind: "do_not_call", label: "Client do-not-call request" },
  { kind: "recording_flagged", label: "Recording flagged for compliance" },
];

function ChannelPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const prefs = useQuery({
    queryKey: ["notif-prefs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_preferences" as any)
        .select("*").eq("user_id", user!.id);
      const map: Record<string, { in_app: boolean; email: boolean; sms: boolean }> = {};
      for (const r of (data ?? []) as any[]) map[r.kind] = { in_app: r.in_app, email: r.email, sms: r.sms };
      return map;
    },
    enabled: !!user?.id,
  });

  const save = useMutation({
    mutationFn: async ({ kind, channel, value }: { kind: string; channel: "in_app" | "email" | "sms"; value: boolean }) => {
      const current = prefs.data?.[kind] ?? { in_app: true, email: false, sms: false };
      const next = { ...current, [channel]: value };
      await supabase.from("notification_preferences" as any).upsert({
        user_id: user!.id, kind, ...next, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,kind" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-prefs"] }),
  });

  return (
    <CCWidget title="Channel preferences" description="Pick where each alert reaches you. Email and SMS are off by default.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[color:var(--cc-ink-500)]">
              <th className="py-2 pr-4">Notification</th>
              <th className="py-2 px-2 text-center">In-app</th>
              <th className="py-2 px-2 text-center">Email</th>
              <th className="py-2 px-2 text-center">SMS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--cc-ink-100)]">
            {NOTIFICATION_KINDS.map(({ kind, label }) => {
              const p = prefs.data?.[kind] ?? { in_app: true, email: false, sms: false };
              return (
                <tr key={kind}>
                  <td className="py-2 pr-4">{label}</td>
                  {(["in_app", "email", "sms"] as const).map((ch) => (
                    <td key={ch} className="py-2 px-2 text-center">
                      <CCCheckbox checked={p[ch]} onChange={(v) => save.mutate({ kind, channel: ch, value: v })} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CCWidget>
  );
}