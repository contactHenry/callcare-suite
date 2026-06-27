import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCStatusPill, CCWidget, CCFormSection, CCFormGrid, CCField,
  CCInput, CCTextarea, CCSelect, CCCheckbox,
} from "@/components/cc";

export const Route = createFileRoute("/_authenticated/announcements/")({
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { user, atLeast } = useAuth();
  const qc = useQueryClient();
  const canPost = atLeast("team_leader");
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ["announcements", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements" as any)
        .select("*, author:profiles!announcements_author_id_fkey(full_name)")
        .order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const reads = useQuery({
    queryKey: ["announcement-reads", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcement_reads" as any).select("announcement_id").eq("user_id", user!.id);
      return new Set(((data ?? []) as any[]).map((r: any) => r.announcement_id));
    },
    enabled: !!user?.id,
  });

  const ack = useMutation({
    mutationFn: async (announcement_id: string) => {
      await supabase.from("announcement_reads" as any).insert({ announcement_id, user_id: user!.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcement-reads"] }),
  });

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Team and organisation-wide updates."
        actions={canPost ? <CCButton onClick={() => setOpen(true)}>Post announcement</CCButton> : null}
      />
      <div className="p-6 space-y-4">
        {((list.data ?? []) as any[]).map((a) => {
          const tone: any = a.urgency === "urgent" ? "danger" : a.urgency === "high" ? "warning" : "info";
          const isRead = reads.data?.has(a.id);
          return (
            <CCWidget key={a.id} title={a.title}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <CCStatusPill tone={tone} dot>{a.urgency}</CCStatusPill>
                <span className="text-xs text-[color:var(--cc-ink-500)]">
                  {a.author?.full_name ?? "—"} · {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-[color:var(--cc-ink-700)] whitespace-pre-wrap leading-relaxed">{a.body}</p>
              {a.require_ack && (
                <div className="mt-3 pt-3 border-t border-[color:var(--cc-ink-100)]">
                  {isRead ? (
                    <CCStatusPill tone="success" dot>Acknowledged</CCStatusPill>
                  ) : (
                    <CCButton size="sm" onClick={() => ack.mutate(a.id)}>Acknowledge</CCButton>
                  )}
                </div>
              )}
            </CCWidget>
          );
        })}
        {list.data && list.data.length === 0 && (
          <div className="text-center text-sm text-[color:var(--cc-ink-500)] py-10">No announcements yet.</div>
        )}
      </div>
      {open && <NewAnnouncementDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["announcements"] }); }} />}
    </>
  );
}

function NewAnnouncementDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [requireAck, setRequireAck] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements" as any).insert({
        title, body, urgency, require_ack: requireAck, author_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: onClose,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CCFormSection title="Post announcement">
          <CCFormGrid>
            <CCField label="Title"><CCInput value={title} onChange={(e) => setTitle(e.target.value)} /></CCField>
            <CCField label="Urgency">
              <CCSelect value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </CCSelect>
            </CCField>
          </CCFormGrid>
          <CCField label="Body"><CCTextarea value={body} onChange={(e) => setBody(e.target.value)} /></CCField>
          <CCCheckbox checked={requireAck} onChange={setRequireAck} label="Require acknowledgement" />
          <div className="flex justify-end gap-2">
            <CCButton variant="ghost" onClick={onClose}>Cancel</CCButton>
            <CCButton onClick={() => create.mutate()} disabled={!title || !body || create.isPending}>Post</CCButton>
          </div>
        </CCFormSection>
      </div>
    </div>
  );
}