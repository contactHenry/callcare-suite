import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  listClients, bulkAssign, exportClients, listAssignableAgents,
  findDuplicates, mergeClients, requestClientExport,
} from "@/lib/clients.functions";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCStatusPill, CCInput, CCSelect, CCField,
  CCTable, CCThead, CCTh, CCTd, CCTr,
} from "@/components/cc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Phone, Download, Upload, Users, GitMerge, ShieldCheck, X, Delete, PhoneCall, PhoneOff, Mic, MicOff, Pause, Volume2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { DUMMY_CLIENTS } from "@/lib/dummy-data";
import { cn } from "@/lib/utils";
import { placeOutboundCall, getTelephonySettings } from "@/lib/calls.functions";
import { setActiveCall } from "@/lib/call-session";
import type { CallSession } from "@/components/CallControlBar";

export const Route = createFileRoute("/_authenticated/clients/")({ component: ClientsPage });

const STATUSES = [
  "new","assigned","contacted","follow_up","interested","not_interested",
  "converted","unreachable","invalid","complaint","escalated","do_not_call","closed",
] as const;

const STATUS_TONE: Record<string, "success"|"warning"|"danger"|"info"|"neutral"> = {
  new: "info", assigned: "info", contacted: "info", follow_up: "warning",
  interested: "success", not_interested: "neutral", converted: "success",
  unreachable: "warning", invalid: "danger", complaint: "danger",
  escalated: "danger", do_not_call: "danger", closed: "neutral",
};

function ClientsPage() {
  const qc = useQueryClient();
  const { atLeast } = useAuth();
  const listFn = useServerFn(listClients);
  const bulkAssignFn = useServerFn(bulkAssign);
  const exportFn = useServerFn(exportClients);
  const requestExportFn = useServerFn(requestClientExport);
  const agentsFn = useServerFn(listAssignableAgents);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [consent, setConsent] = useState<string>("");
  const [dnc, setDnc] = useState<string>("");
  const [sort, setSort] = useState<"created"|"name"|"last_contacted"|"next_follow_up">("created");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAssign, setShowAssign] = useState(false);
  const [showDupes, setShowDupes] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportReason, setExportReason] = useState("");
  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerNumber, setDialerNumber] = useState("");
  const [dialerName, setDialerName] = useState<string | null>(null);
  const [dialerContactId, setDialerContactId] = useState<string | null>(null);
  const [telSettings, setTelSettings] = useState<any>(null);
  const [inCall, setInCall] = useState(false);
  useEffect(() => { (async () => { try { setTelSettings(await getTelephonySettings()); } catch {} })(); }, []);

  const query = useQuery({
    queryKey: ["clients", { search, statusFilter, consent, dnc, sort, page }],
    queryFn: () => listFn({ data: {
      search: search || undefined,
      status: statusFilter ? [statusFilter] : undefined,
      consent: (consent || undefined) as any,
      doNotCall: dnc === "" ? null : dnc === "true",
      sort, direction: "desc", page, pageSize: 50,
    }}),
  });
  const agentsQuery = useQuery({ queryKey: ["assignable-agents"], queryFn: () => agentsFn() });

  const apiRows = query.data?.rows ?? [];
  const usingDummy = apiRows.length === 0;
  const rows: any[] = usingDummy ? DUMMY_CLIENTS : apiRows;
  const total = usingDummy ? DUMMY_CLIENTS.length : (query.data?.total ?? 0);
  const allOnPage = useMemo(() => new Set(rows.map((r: any) => r.id)), [rows]);

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    const next = new Set(selected);
    const allChecked = rows.every((r: any) => next.has(r.id));
    if (allChecked) rows.forEach((r: any) => next.delete(r.id));
    else rows.forEach((r: any) => next.add(r.id));
    setSelected(next);
  }

  async function handleDirectExport() {
    try {
      const ids = selected.size ? [...selected] : undefined;
      const res = await exportFn({ data: { ids } });
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `clients-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.count} clients`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    }
  }

  async function submitExportRequest() {
    try {
      const ids = selected.size ? [...selected] : undefined;
      await requestExportFn({ data: {
        scope: ids ? "selected" : "filtered",
        ids,
        filter: { search, statusFilter, consent, dnc },
        reason: exportReason || undefined,
      }});
      toast.success("Export request submitted for approval");
      setShowExport(false);
      setExportReason("");
    } catch (e: any) { toast.error(e?.message ?? "Request failed"); }
  }

  function openDialer(number: string, name?: string | null, contactId?: string | null) {
    setDialerNumber(number);
    setDialerName(name ?? null);
    setDialerContactId(contactId ?? null);
    setDialerOpen(true);
    setInCall(false);
  }

  async function startCall() {
    if (!dialerNumber) return;
    setInCall(true);
    try {
      const r = await placeOutboundCall({ data: { contactId: dialerContactId, toNumber: dialerNumber } });
      const newSession: CallSession = {
        callId: r.callId,
        toNumber: dialerNumber,
        contactName: dialerName,
        startedAt: new Date().toISOString(),
        direction: "outbound",
        recording: telSettings?.recording_enabled ?? true,
        consentNotice: telSettings?.recording_consent_notice ?? null,
        voicemailDropEnabled: telSettings?.voicemail_drop_enabled ?? false,
      };
      setActiveCall(newSession);
      toast.success("Calling…");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not place call");
    }
  }

  function endCall() {
    setInCall(false);
    setActiveCall(null);
  }

  const canImport = atLeast("team_leader");
  const canApprove = atLeast("supervisor");
  const canExportDirect = atLeast("supervisor");

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${total.toLocaleString()} total — agents see assigned, supervisors see org`}
        actions={
          <div className="flex items-center gap-2">
            {canApprove && (
              <Link to="/clients/approvals">
                <CCButton variant="ghost"><ShieldCheck className="size-4 mr-1" />Approvals</CCButton>
              </Link>
            )}
            {canImport && (
              <Link to="/clients/import">
                <CCButton variant="ghost"><Upload className="size-4 mr-1" />Import</CCButton>
              </Link>
            )}
            {canExportDirect ? (
              <CCButton variant="ghost" onClick={handleDirectExport}><Download className="size-4 mr-1" />Export</CCButton>
            ) : (
              <CCButton variant="ghost" onClick={() => setShowExport(true)}><Download className="size-4 mr-1" />Request export</CCButton>
            )}
            <CCButton variant="ghost" onClick={() => setShowDupes(true)}><GitMerge className="size-4 mr-1" />Duplicates</CCButton>
          </div>
        }
      />
      <div className="px-6 py-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] items-end">
        <CCField label="Search">
          <CCInput placeholder="Name, phone, email, company…" value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </CCField>
        <CCField label="Status">
          <CCSelect value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
          </CCSelect>
        </CCField>
        <CCField label="Consent">
          <CCSelect value={consent} onChange={(e) => { setPage(1); setConsent(e.target.value); }}>
            <option value="">Any</option>
            <option value="granted">Granted</option>
            <option value="revoked">Revoked</option>
            <option value="unknown">Unknown</option>
          </CCSelect>
        </CCField>
        <CCField label="DNC">
          <CCSelect value={dnc} onChange={(e) => { setPage(1); setDnc(e.target.value); }}>
            <option value="">Any</option>
            <option value="false">Callable</option>
            <option value="true">Do not call</option>
          </CCSelect>
        </CCField>
        <CCField label="Sort">
          <CCSelect value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value="created">Created</option>
            <option value="last_contacted">Last contacted</option>
            <option value="next_follow_up">Next follow-up</option>
            <option value="name">Name</option>
          </CCSelect>
        </CCField>
      </div>

      {selected.size > 0 && (
        <div className="mx-6 mb-3 flex items-center justify-between rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-[color:var(--cc-ink-50)] px-3 py-2 text-sm">
          <span>{selected.size} selected</span>
          <div className="flex gap-2">
            <CCButton variant="ghost" onClick={() => setSelected(new Set())}>Clear</CCButton>
            {atLeast("team_leader") && (
              <CCButton onClick={() => setShowAssign(true)}><Users className="size-4 mr-1" />Assign</CCButton>
            )}
          </div>
        </div>
      )}

      <div className={cn("px-6 pb-6 gap-4 flex", dialerOpen ? "flex-row" : "flex-col")}>
        <div className={cn("bg-white transition-all", dialerOpen ? "flex-1 min-w-0" : "w-full")}>
          <CCTable>
            <CCThead>
              <tr>
                <CCTh className="w-8">
                  <input type="checkbox"
                    checked={rows.length > 0 && rows.every((r: any) => selected.has(r.id))}
                    onChange={toggleAll} />
                </CCTh>
                <CCTh>Name</CCTh>
                <CCTh>Phone</CCTh>
                <CCTh>Status</CCTh>
                <CCTh>Last contact</CCTh>
                <CCTh>Next follow-up</CCTh>
                <CCTh className="text-right">Quick</CCTh>
              </tr>
            </CCThead>
            <tbody>
              {rows.length === 0 && (
                <tr><CCTd className="text-[color:var(--cc-ink-500)]">No clients match.</CCTd></tr>
              )}
              {rows.map((c: any) => (
                <CCTr key={c.id}>
                  <CCTd>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)}
                      onClick={(e) => e.stopPropagation()} />
                  </CCTd>
                  <CCTd>
                    <Link to="/clients/$id" params={{ id: c.id }} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-xs text-[color:var(--cc-ink-500)]">{c.email ?? "—"} {c.company ? `· ${c.company}` : ""}</div>
                  </CCTd>
                  <CCTd>
                    {c.phone ? (
                      <button
                        type="button"
                        onClick={() => openDialer(c.phone, c.name, c.id)}
                        className="inline-flex items-center gap-1.5 text-[color:var(--cc-info)] hover:underline"
                      >
                        <Phone className="size-3.5" />{c.phone}
                      </button>
                    ) : "—"}
                  </CCTd>
                  <CCTd>
                    <CCStatusPill tone={STATUS_TONE[c.lifecycle_status] ?? "neutral"} dot>
                      {(c.lifecycle_status ?? "new").replace("_"," ")}
                    </CCStatusPill>
                    {c.do_not_call && <CCStatusPill tone="danger" className="ml-1">DNC</CCStatusPill>}
                  </CCTd>
                  <CCTd className="text-xs text-[color:var(--cc-ink-500)]">{fmt(c.last_contacted_at)}</CCTd>
                  <CCTd className="text-xs text-[color:var(--cc-ink-500)]">{fmt(c.next_follow_up_at)}</CCTd>
                  <CCTd className="text-right">
                    {c.phone && (
                      <CCButton variant="ghost" size="sm" onClick={() => openDialer(c.phone, c.name, c.id)}>
                        <Phone className="size-4" />
                      </CCButton>
                    )}
                  </CCTd>
                </CCTr>
              ))}
            </tbody>
          </CCTable>
          <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--cc-ink-500)]">
            <span>Page {page} · {rows.length} of {total}</span>
            <div className="flex gap-2">
              <CCButton size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</CCButton>
              <CCButton size="sm" variant="ghost" disabled={rows.length < 50} onClick={() => setPage((p) => p + 1)}>Next</CCButton>
            </div>
          </div>
        </div>

        {dialerOpen && (
          <DialerPanel
            number={dialerNumber}
            name={dialerName}
            onNumberChange={setDialerNumber}
            onClose={() => { setDialerOpen(false); setInCall(false); setActiveCall(null); }}
            onCall={startCall}
            inCall={inCall}
            onEndCall={endCall}
          />
        )}
      </div>

      <AssignDialog
        open={showAssign} onClose={() => setShowAssign(false)}
        agents={agentsQuery.data?.agents ?? []}
        onAssign={async (agentId) => {
          try {
            await bulkAssignFn({ data: { ids: [...selected], agentId } });
            toast.success(`Assigned ${selected.size} clients`);
            setSelected(new Set());
            setShowAssign(false);
            qc.invalidateQueries({ queryKey: ["clients"] });
          } catch (e: any) { toast.error(e?.message ?? "Assign failed"); }
        }}
      />
      <DuplicatesDialog open={showDupes} onClose={() => setShowDupes(false)} />
      <Dialog open={showExport} onOpenChange={(v) => !v && setShowExport(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request client export</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-[color:var(--cc-ink-500)]">
              Exports must be approved by a supervisor. {selected.size > 0
                ? `${selected.size} selected client${selected.size === 1 ? "" : "s"} will be included.`
                : "Your current filters will be saved with the request."}
            </p>
            <CCField label="Reason (optional)">
              <CCInput placeholder="Why is this export needed?" value={exportReason}
                onChange={(e) => setExportReason(e.target.value)} />
            </CCField>
            <div className="flex justify-end gap-2">
              <CCButton variant="ghost" onClick={() => setShowExport(false)}>Cancel</CCButton>
              <CCButton onClick={submitExportRequest}>Submit request</CCButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function fmt(s?: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString(); } catch { return "—"; }
}

function AssignDialog({ open, onClose, agents, onAssign }:
  { open: boolean; onClose: () => void; agents: { id: string; full_name: string | null }[]; onAssign: (id: string) => void }) {
  const [agent, setAgent] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign selected clients</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <CCField label="Agent">
            <CCSelect value={agent} onChange={(e) => setAgent(e.target.value)}>
              <option value="">Select agent…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? a.id}</option>)}
            </CCSelect>
          </CCField>
          <div className="flex justify-end gap-2">
            <CCButton variant="ghost" onClick={onClose}>Cancel</CCButton>
            <CCButton disabled={!agent} onClick={() => onAssign(agent)}>Assign</CCButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DuplicatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dupesFn = useServerFn(findDuplicates);
  const mergeFn = useServerFn(mergeClients);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["dupes"], queryFn: () => dupesFn(), enabled: open });
  const [chosenSurvivor, setChosenSurvivor] = useState<Record<string, string>>({});

  async function merge(groupKey: string, rows: any[]) {
    const survivor = chosenSurvivor[groupKey] ?? rows[0].id;
    const mergedIds = rows.filter((r) => r.id !== survivor).map((r) => r.id);
    try {
      await mergeFn({ data: { survivingId: survivor, mergedIds } });
      toast.success("Merged");
      qc.invalidateQueries({ queryKey: ["dupes"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (e: any) { toast.error(e?.message ?? "Merge failed"); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Duplicate clients</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {(q.data?.groups ?? []).length === 0 && (
            <p className="text-sm text-[color:var(--cc-ink-500)]">No duplicates detected in the most recent 1,000 clients.</p>
          )}
          {(q.data?.groups ?? []).map((g: any) => (
            <div key={g.key} className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] p-3">
              <div className="mb-2 text-xs text-[color:var(--cc-ink-500)]">Match key: {g.key}</div>
              <ul className="space-y-1">
                {g.rows.map((r: any) => (
                  <li key={r.id} className="flex items-center gap-2 text-sm">
                    <input type="radio" name={`s-${g.key}`}
                      checked={(chosenSurvivor[g.key] ?? g.rows[0].id) === r.id}
                      onChange={() => setChosenSurvivor((m) => ({ ...m, [g.key]: r.id }))} />
                    <span className="font-medium">{r.name}</span>
                    <span className="text-[color:var(--cc-ink-500)]">{r.phone ?? ""} {r.email ?? ""}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-end">
                <CCButton size="sm" onClick={() => merge(g.key, g.rows)}>Merge into selected</CCButton>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialerPanel({
  number,
  name,
  onNumberChange,
  onClose,
  onCall,
}: {
  number: string;
  name: string | null;
  onNumberChange: (n: string) => void;
  onClose: () => void;
  onCall: () => void;
}) {
  function dial(digit: string) {
    onNumberChange((number + digit).replace(/[^+\d*#]/g, "").slice(0, 18));
  }
  function backspace() {
    onNumberChange(number.slice(0, -1));
  }
  function clear() {
    onNumberChange("");
  }

  const digits = [
    ["1", ""], ["2", "ABC"], ["3", "DEF"],
    ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
    ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
    ["*", ""], ["0", "+"], ["#", ""],
  ] as const;

  return (
    <div className="w-[320px] shrink-0 rounded-[var(--cc-radius-lg)] border border-[color:var(--cc-ink-200)] bg-[color:var(--cc-ink-0)] p-4 shadow-[var(--cc-shadow-md)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{name ?? "Manual dial"}</div>
          <div className="text-xs text-[color:var(--cc-ink-500)] truncate">{number || "Enter a number"}</div>
        </div>
        <CCButton variant="ghost" size="sm" onClick={onClose} aria-label="Close dialer"><X className="size-4" /></CCButton>
      </div>

      <CCInput
        value={number}
        onChange={(e) => onNumberChange(e.target.value.replace(/[^+\d*#]/g, "").slice(0, 18))}
        placeholder="Phone number"
        className="mb-3 text-center text-lg font-mono"
      />

      <div className="grid grid-cols-3 gap-2 mb-3">
        {digits.map(([d, letters]) => (
          <button
            key={d}
            type="button"
            onClick={() => dial(d)}
            className="flex flex-col items-center justify-center rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-[color:var(--cc-ink-50)] py-2 hover:bg-[color:var(--cc-ink-100)] active:bg-[color:var(--cc-ink-200)] transition-colors"
          >
            <span className="text-lg font-medium leading-none">{d}</span>
            {letters && <span className="text-[10px] text-[color:var(--cc-ink-500)] tracking-wider">{letters}</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <CCButton variant="ghost" size="sm" onClick={clear} aria-label="Clear">Clear</CCButton>
        <CCButton variant="success" onClick={onCall} disabled={!number} aria-label="Call">
          <PhoneCall className="size-4 mr-1" />Call
        </CCButton>
        <CCButton variant="ghost" size="sm" onClick={backspace} aria-label="Backspace">
          <Delete className="size-4" />
        </CCButton>
      </div>

      {name && (
        <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-[color:var(--cc-ink-50)] p-2 text-xs text-[color:var(--cc-ink-500)]">
          Calling {name}
        </div>
      )}
    </div>
  );
}