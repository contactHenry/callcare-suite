import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { DUMMY_CALLS } from "@/lib/dummy-data";

const OUTCOME_CLASS: Record<string, string> = {
  resolved: "bg-green-100 text-green-800 hover:bg-green-100",
  follow_up: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  escalated: "bg-red-100 text-red-800 hover:bg-red-100",
  no_answer: "bg-red-100 text-red-800 hover:bg-red-100",
  voicemail: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
};

const DIRECTION_CLASS: Record<string, string> = {
  inbound: "bg-green-100 text-green-800 hover:bg-green-100",
  outbound: "bg-blue-100 text-blue-800 hover:bg-blue-100",
};

function qaClass(score: number) {
  if (score >= 80) return "bg-green-100 text-green-800 hover:bg-green-100";
  if (score >= 65) return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
  return "bg-red-100 text-red-800 hover:bg-red-100";
}

export const Route = createFileRoute("/_authenticated/calls/")({
  component: CallsList,
});

function CallsList() {
  const [open, setOpen] = useState(false);
  const { data: realCalls = [] } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*, contacts(name), qa_reviews(overall_score)")
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const ids = Array.from(new Set(rows.map((r) => r.agent_id)));
      let profiles: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name ?? ""]));
      }
      return rows.map((r) => ({ ...r, agent_name: profiles[r.agent_id] ?? "—" }));
    },
  });

  const isSample = realCalls.length === 0;
  const calls: any[] = isSample ? DUMMY_CALLS : realCalls;

  return (
    <>
      <PageHeader
        title="Calls"
        description="Recent calls logged across the team."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4 mr-2" /> New call
          </Button>
        }
      />
      <NewCallDialog open={open} onOpenChange={setOpen} />
      <div className="p-6">
        {isSample && (
          <div className="mb-3 text-xs text-muted-foreground">
            Showing sample data for preview. Log a call to see live entries.
          </div>
        )}
        <Card className="rounded-none border-0 shadow-none bg-transparent p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">QA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((c) => {
                const qa = Array.isArray(c.qa_reviews) ? c.qa_reviews[0] : c.qa_reviews;
                const score = qa?.overall_score;
                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-accent/30">
                    <TableCell>
                      {isSample ? (
                        <span>{new Date(c.started_at).toLocaleString()}</span>
                      ) : (
                        <Link to="/calls/$id" params={{ id: c.id }} className="hover:underline">
                          {new Date(c.started_at).toLocaleString()}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{c.contacts?.name ?? "—"}</TableCell>
                <TableCell>{c.agent_name}</TableCell>
                    <TableCell>
                      <Badge className={`capitalize border-0 ${DIRECTION_CLASS[c.direction] ?? "bg-muted text-muted-foreground"}`}>
                        {c.direction}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`capitalize border-0 ${OUTCOME_CLASS[c.outcome] ?? "bg-muted text-muted-foreground"}`}>
                        {String(c.outcome).replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {score != null ? (
                        <Badge className={`border-0 ${qaClass(Number(score))}`}>{Math.round(Number(score))}%</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}

function NewCallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({
    contact_id: "",
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
        const { error: upErr } = await supabase.storage
          .from("call-recordings")
          .upload(path, file, { contentType: file.type || "audio/mpeg" });
        if (upErr) throw upErr;
        audio_path = path;
      }
      const { error } = await supabase.from("calls").insert({
        agent_id: user.id,
        contact_id: form.contact_id || null,
        direction: form.direction,
        outcome: form.outcome,
        duration_seconds: Math.round(form.duration_minutes * 60),
        notes: form.notes || null,
        audio_path,
      });
      if (error) throw error;
      toast.success("Call logged");
      qc.invalidateQueries({ queryKey: ["calls"] });
      onOpenChange(false);
      setForm({ contact_id: "", direction: "outbound", outcome: "completed", duration_minutes: 5, notes: "" });
      setFile(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to log call");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a call</DialogTitle>
          <DialogDescription>
            Capture call details and optionally attach an audio recording for QA.
          </DialogDescription>
        </DialogHeader>
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
              <Input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Upload className="size-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Stored privately; only you and managers can access it.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save call"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}