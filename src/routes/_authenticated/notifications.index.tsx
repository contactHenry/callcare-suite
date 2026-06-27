import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCStatusPill, CCWidget } from "@/components/cc";
import { DUMMY_NOTIFICATIONS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/notifications/")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

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
          unreadCount > 0 ? (
            <CCButton size="sm" variant="secondary" onClick={() => markAll.mutate()}>
              Mark all read ({unreadCount})
            </CCButton>
          ) : null
        }
      />
      <div className="p-6 space-y-4">
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