import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ contactId: z.string().optional() });

export const Route = createFileRoute("/_authenticated/calls/new")({
  validateSearch: searchSchema,
  component: NewCall,
});

function NewCall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { contactId } = Route.useSearch();

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    contact_id: contactId ?? "",
    direction: "outbound",
    outcome: "completed",
    duration_minutes: 5,
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      let audio_path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("call-recordings").upload(path, file, {
          contentType: file.type || "audio/mpeg",
        });
        if (upErr) throw upErr;
        audio_path = path;
      }
      const { data, error } = await supabase
        .from("calls")
        .insert({
          agent_id: user.id,
          contact_id: form.contact_id || null,
          direction: form.direction,
          outcome: form.outcome,
          duration_seconds: Math.round(form.duration_minutes * 60),
          notes: form.notes || null,
          audio_path,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Call logged");
      navigate({ to: "/calls/$id", params: { id: data.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to log call");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Log a call" description="Capture call details and optionally attach an audio recording for QA." />
      <div className="p-6 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Call details</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label>Contact</Label>
                <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select contact (optional)" /></SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Direction</Label>
                  <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Outcome</Label>
                  <Select value={form.outcome} onValueChange={(v) => setForm({ ...form, outcome: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="voicemail">Voicemail</SelectItem>
                      <SelectItem value="no_answer">No answer</SelectItem>
                      <SelectItem value="follow_up">Follow up</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Summary, next steps…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Recording (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <Upload className="size-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">Stored privately; only you and managers can access it.</p>
              </div>
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save call"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}