import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listRecordings, getRecordingUrl, tagCallReview, setSupervisorComments, listCampaigns } from "@/lib/calls.functions";
import { Search, Play, Tag, MessageSquare, ShieldAlert, Headphones, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { toast } from "sonner";
import { DUMMY_RECORDINGS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/recordings/")({
  component: RecordingsLibrary,
});

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function RecordingsLibrary() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["recordings", search, from, to, campaignId],
    queryFn: () => listRecordings({ data: {
      search: search || undefined, from: from || undefined, to: to || undefined,
      campaignId: campaignId || undefined, limit: 50, offset: 0,
    } }),
  });
  const rows: any[] = (data?.rows && data.rows.length > 0) ? data.rows : DUMMY_RECORDINGS;
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-mini"], queryFn: () => listCampaigns(),
  });
  const active = activeIdx != null ? rows[activeIdx] : null;

  return (
    <div>
      <PageHeader
        title="Recordings"
        description="Review, score and tag call recordings. Every playback is audit-logged."
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Search number</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="+1 555…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Campaign</Label>
            <select
              className="h-9 border rounded-md px-2 text-sm min-w-[160px]"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">All campaigns</option>
              {(campaigns as any[]).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Button variant="outline" onClick={() => refetch()}>Apply</Button>
        </div>

        <div className="border-b">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!isLoading && rows.map((r: any, i: number) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="text-sm">{new Date(r.started_at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline">{r.direction}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{r.direction === "outbound" ? r.to_number : r.from_number}</TableCell>
                  <TableCell className="text-sm">{r.contacts?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{fmt(r.duration_seconds ?? 0)}</TableCell>
                  <TableCell>
                    {r.quality_score != null
                      ? <Badge className={r.quality_score >= 80 ? "bg-green-100 text-green-800" : r.quality_score >= 65 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>{r.quality_score}%</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {r.recording_sensitive && <Badge className="bg-red-100 text-red-800 inline-flex items-center gap-1"><ShieldAlert className="size-3" /> Sensitive</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setActiveIdx(i)}><Play className="size-3 mr-1" /> Open</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <RecordingPlaybackDialog
        call={active}
        position={activeIdx != null ? { index: activeIdx, total: rows.length } : null}
        onPrev={activeIdx != null && activeIdx > 0 ? () => setActiveIdx(activeIdx - 1) : null}
        onNext={activeIdx != null && activeIdx < rows.length - 1 ? () => setActiveIdx(activeIdx + 1) : null}
        onClose={() => setActiveIdx(null)}
      />
    </div>
  );
}

function RecordingPlaybackDialog({
  call, onClose, onPrev, onNext, position,
}: {
  call: any | null;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  position: { index: number; total: number } | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [tag, setTag] = useState("");
  const [markedFor, setMarkedFor] = useState<string>("");
  const [comments, setComments] = useState("");
  const [rate, setRate] = useState(1);

  // Keyboard nav across the queue
  useEffect(() => {
    if (!call) return;
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt?.tagName === "INPUT" || tgt?.tagName === "TEXTAREA" || tgt?.isContentEditable) return;
      if (e.key === "ArrowRight" && onNext) { setUrl(null); onNext(); }
      if (e.key === "ArrowLeft" && onPrev) { setUrl(null); onPrev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [call, onNext, onPrev]);

  async function load() {
    try {
      const r = await getRecordingUrl({ data: { callId: call!.id, reason: reason || undefined } });
      setUrl(r.url);
    } catch (e: any) { toast.error(e?.message ?? "Cannot play recording"); }
  }

  async function saveTag() {
    if (!tag.trim()) return;
    try {
      await tagCallReview({ data: { callId: call!.id, tag: tag.trim(), markedFor: markedFor || undefined } });
      toast.success("Tag saved");
      setTag(""); setMarkedFor("");
    } catch (e: any) { toast.error(e?.message ?? "Could not tag"); }
  }
  async function saveComments() {
    if (!comments.trim()) return;
    try {
      await setSupervisorComments({ data: { callId: call!.id, comments } });
      toast.success("Comments saved");
    } catch (e: any) { toast.error(e?.message ?? "Could not save"); }
  }

  return (
    <Dialog open={!!call} onOpenChange={(o) => { if (!o) { setUrl(null); onClose(); } }}>
      <DialogContent key={call?.id} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Recording — {call?.contacts?.name ?? "Unknown"}</span>
            {position && (
              <span className="text-xs font-normal text-muted-foreground">
                {position.index + 1} of {position.total}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={!onPrev}
                onClick={() => { setUrl(null); onPrev?.(); }}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={!onNext}
                onClick={() => { setUrl(null); onNext?.(); }}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        {!url ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Provide a reason for access (audit-logged). Required for sensitive recordings.
            </p>
            <Textarea rows={2} placeholder="e.g. Coaching review for ticket #2381" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button onClick={load}><Headphones className="size-4 mr-2" /> Load recording</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <audio src={url} controls className="w-full" onLoadedMetadata={(e) => ((e.target as HTMLAudioElement).playbackRate = rate)} />
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Speed</span>
              {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                <Button key={r} size="sm" variant={rate === r ? "default" : "outline"}
                  onClick={() => {
                    setRate(r);
                    const a = document.querySelector("audio"); if (a) (a as HTMLAudioElement).playbackRate = r;
                  }}>{r}×</Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><Tag className="size-3" /> Tag for</Label>
                <select className="w-full border rounded h-9 px-2 text-sm" value={markedFor} onChange={(e) => setMarkedFor(e.target.value)}>
                  <option value="">— purpose —</option>
                  <option value="coaching">Coaching</option>
                  <option value="compliance">Compliance</option>
                  <option value="escalation">Escalation</option>
                  <option value="exemplar">Exemplar</option>
                </select>
                <div className="flex gap-2">
                  <Input placeholder="Tag (e.g. tone)" value={tag} onChange={(e) => setTag(e.target.value)} />
                  <Button size="sm" onClick={saveTag}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {["Coaching", "Compliance", "Exemplar", "Tone", "Script adherence"].map((t) => (
                    <button key={t} type="button"
                      onClick={() => setTag(t)}
                      className="text-[11px] px-2 py-0.5 rounded-full border bg-muted/40 hover:bg-muted">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><MessageSquare className="size-3" /> Supervisor comments</Label>
                <Textarea rows={4} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Feedback for the agent…" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveComments}>Save comments</Button>
                  <Button size="sm" variant="outline"
                    onClick={() => tagCallReview({ data: { callId: call!.id, tag: "FLAGGED", markedFor: "coaching" } }).then(() => toast.success("Flagged for coaching"))}>
                    <Flag className="size-3 mr-1" /> Flag for coaching
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              Use ←/→ to move through the queue
            </span>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}