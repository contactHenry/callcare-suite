import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  listClients, bulkAssign, exportClients, listAssignableAgents,
  requestClientExport, createClient, getClient,
} from "@/lib/clients.functions";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCStatusPill, CCInput, CCSelect, CCField,
  CCTable, CCThead, CCTh, CCTd, CCTr,
} from "@/components/cc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Phone, Download, Upload, Users, ShieldCheck, X, Delete, PhoneCall, PhoneOff, Mic, MicOff, Pause, PhoneForwarded, Plus, Mail, MapPin, Tag } from "lucide-react";
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
  const createClientFn = useServerFn(createClient);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [consent, setConsent] = useState<string>("");
  const [dnc, setDnc] = useState<string>("");
  const [sort, setSort] = useState<"created"|"name"|"last_contacted"|"next_follow_up">("created");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAssign, setShowAssign] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportReason, setExportReason] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
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
    // Normalize to E.164: strip everything but digits and a leading +.
    const digits = dialerNumber.replace(/[^\d+]/g, "");
    const toNumber = digits.startsWith("+") ? digits : `+${digits.replace(/^\+/, "")}`;
    if (!/^\+[1-9]\d{7,14}$/.test(toNumber)) {
      toast.error("Enter a valid phone number in international format (e.g. +15551234567)");
      return;
    }
    const contactId =
      dialerContactId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dialerContactId)
        ? dialerContactId
        : null;
    setInCall(true);
    try {
      const r = await placeOutboundCall({ data: { contactId, toNumber } });
      const newSession: CallSession = {
        callId: r.callId,
        toNumber,
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
            <CCButton onClick={() => setShowCreate(true)}><Plus className="size-4 mr-1" />Add client</CCButton>
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
                <CCTr key={c.id} onClick={() => setDetailsId(c.id)} className="cursor-pointer">
                  <CCTd>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)}
                      onClick={(e) => e.stopPropagation()} />
                  </CCTd>
                  <CCTd>
                    <span className="font-medium">{c.name}</span>
                    <div className="text-xs text-[color:var(--cc-ink-500)]">{c.email ?? "—"} {c.company ? `· ${c.company}` : ""}</div>
                  </CCTd>
                  <CCTd>
                    {c.phone ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openDialer(c.phone, c.name, c.id); }}
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
                      <CCButton variant="ghost" size="sm" onClick={(e: any) => { e.stopPropagation(); openDialer(c.phone, c.name, c.id); }}>
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
      <AddClientDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={async (payload) => {
          try {
            await createClientFn({ data: payload });
            toast.success("Client created");
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["clients"] });
          } catch (e: any) { toast.error(e?.message ?? "Create failed"); }
        }}
      />
      <ClientDetailsDialog id={detailsId} onClose={() => setDetailsId(null)} />
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

type NewClient = {
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  address_line1?: string | null;
  address_city?: string | null;
  notes?: string | null;
};

function AddClientDialog({ open, onClose, onCreate }:
  { open: boolean; onClose: () => void; onCreate: (payload: NewClient) => void | Promise<void> }) {
  const [form, setForm] = useState<NewClient>({ name: "" });
  useEffect(() => { if (!open) setForm({ name: "" }); }, [open]);
  const set = (k: keyof NewClient) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.value === "" ? null : e.target.value }));
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add new client</DialogTitle>
          <DialogDescription>Enter the client's details. You can edit more fields later.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <CCField label="Full name *">
              <CCInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </CCField>
          </div>
          <CCField label="Phone">
            <CCInput value={form.phone ?? ""} onChange={set("phone")} placeholder="+15551234567" />
          </CCField>
          <CCField label="Email">
            <CCInput value={form.email ?? ""} onChange={set("email")} type="email" />
          </CCField>
          <CCField label="Company">
            <CCInput value={form.company ?? ""} onChange={set("company")} />
          </CCField>
          <CCField label="City">
            <CCInput value={form.address_city ?? ""} onChange={set("address_city")} />
          </CCField>
          <div className="md:col-span-2">
            <CCField label="Address">
              <CCInput value={form.address_line1 ?? ""} onChange={set("address_line1")} />
            </CCField>
          </div>
          <div className="md:col-span-2">
            <CCField label="Notes">
              <CCInput value={form.notes ?? ""} onChange={set("notes")} />
            </CCField>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <CCButton variant="ghost" onClick={onClose}>Cancel</CCButton>
          <CCButton disabled={!form.name.trim()} onClick={() => onCreate(form)}>Create client</CCButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientDetailsDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const getFn = useServerFn(getClient);
  const q = useQuery({
    queryKey: ["client-details", id],
    queryFn: () => getFn({ data: { id: id! } }),
    enabled: !!id,
  });
  const c: any = q.data?.client;
  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{c?.name ?? "Client details"}</DialogTitle>
          <DialogDescription>Full client profile and recent activity.</DialogDescription>
        </DialogHeader>
        {q.isLoading && <div className="text-sm text-[color:var(--cc-ink-500)]">Loading…</div>}
        {q.error && <div className="text-sm text-red-600">Failed to load client.</div>}
        {c && (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto text-sm">
            <div className="flex flex-wrap gap-2">
              <CCStatusPill tone={STATUS_TONE[c.lifecycle_status] ?? "neutral"} dot>
                {(c.lifecycle_status ?? "new").replace("_"," ")}
              </CCStatusPill>
              {c.do_not_call && <CCStatusPill tone="danger">DNC</CCStatusPill>}
              {c.consent_status && <CCStatusPill tone="info">Consent: {c.consent_status}</CCStatusPill>}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DetailRow icon={<Phone className="size-4" />} label="Phone" value={c.phone} />
              <DetailRow icon={<Phone className="size-4" />} label="Alt phone" value={c.alt_phone} />
              <DetailRow icon={<Mail className="size-4" />} label="Email" value={c.email} />
              <DetailRow label="Company" value={c.company} />
              <DetailRow label="Category" value={c.category} />
              <DetailRow label="Campaign source" value={c.campaign_source} />
              <DetailRow label="Preferred method" value={c.preferred_method} />
              <DetailRow label="Preferred time" value={c.preferred_time} />
              <DetailRow label="Date of birth" value={c.dob} />
              <DetailRow label="Last contacted" value={fmt(c.last_contacted_at)} />
              <DetailRow label="Next follow-up" value={fmt(c.next_follow_up_at)} />
              <DetailRow label="Created" value={fmt(c.created_at)} />
            </div>
            <div>
              <div className="text-xs font-medium text-[color:var(--cc-ink-500)] mb-1 flex items-center gap-1"><MapPin className="size-3.5" />Address</div>
              <div className="text-[color:var(--cc-ink-700)]">
                {[c.address_line1, c.address_line2, c.address_city, c.address_region, c.address_postcode, c.address_country]
                  .filter(Boolean).join(", ") || "—"}
              </div>
            </div>
            {c.tags?.length ? (
              <div>
                <div className="text-xs font-medium text-[color:var(--cc-ink-500)] mb-1 flex items-center gap-1"><Tag className="size-3.5" />Tags</div>
                <div className="flex flex-wrap gap-1">
                  {c.tags.map((t: string) => <CCStatusPill key={t} tone="neutral">{t}</CCStatusPill>)}
                </div>
              </div>
            ) : null}
            {c.notes && (
              <div>
                <div className="text-xs font-medium text-[color:var(--cc-ink-500)] mb-1">Notes</div>
                <div className="whitespace-pre-wrap rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-[color:var(--cc-ink-50)] p-2">{c.notes}</div>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2">
          <CCButton variant="ghost" onClick={onClose}>Close</CCButton>
          {id && (
            <Link to="/clients/$id" params={{ id }}>
              <CCButton>Open full profile</CCButton>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-[color:var(--cc-ink-500)] mb-0.5 flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-[color:var(--cc-ink-700)]">{value || "—"}</div>
    </div>
  );
}

function DialerPanel({
  number,
  name,
  onNumberChange,
  onClose,
  onCall,
  inCall,
  onEndCall,
}: {
  number: string;
  name: string | null;
  onNumberChange: (n: string) => void;
  onClose: () => void;
  onCall: () => void;
  inCall: boolean;
  onEndCall: () => void;
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

  if (inCall) {
    return <InCallPanel number={number} name={name} onClose={onClose} onEndCall={onEndCall} />;
  }

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

function InCallPanel({
  number,
  name,
  onClose,
  onEndCall,
}: {
  number: string;
  name: string | null;
  onClose: () => void;
  onEndCall: () => void;
}) {
  const [status, setStatus] = useState<"dialing" | "in-call" | "ended">("dialing");
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<"warm" | "cold">("warm");
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferNote, setTransferNote] = useState("");
  const [transferQuery, setTransferQuery] = useState("");
  const TRANSFER_TARGETS = [
    { id: "agent-1", kind: "Agent", name: "Amara Okafor",    detail: "Tier 2 Support · Available",      tone: "ok"   as const },
    { id: "agent-2", kind: "Agent", name: "Diego Hernández", detail: "Billing · Available",             tone: "ok"   as const },
    { id: "agent-3", kind: "Agent", name: "Priya Shah",      detail: "Retention · On a call",           tone: "warn" as const },
    { id: "team-1",  kind: "Team",  name: "Billing queue",   detail: "3 agents available · ~24s wait",  tone: "ok"   as const },
    { id: "team-2",  kind: "Team",  name: "Tier 2 Support",  detail: "1 agent available · ~1m 12s",     tone: "warn" as const },
    { id: "ext-1",   kind: "Ext.",  name: "Supervisor desk", detail: "ext 4501",                        tone: "ok"   as const },
    { id: "ext-2",   kind: "Ext.",  name: "Voicemail",       detail: "ext 9000",                        tone: "ok"   as const },
  ];
  const filteredTargets = TRANSFER_TARGETS.filter((t) =>
    !transferQuery || `${t.name} ${t.detail} ${t.kind}`.toLowerCase().includes(transferQuery.toLowerCase()),
  );
  const selectedTarget = TRANSFER_TARGETS.find((t) => t.id === transferTarget) ?? null;
  const toneDot: Record<string, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", breach: "bg-rose-500" };
  function confirmTransfer() {
    if (!selectedTarget) return;
    toast.success(
      transferMode === "warm"
        ? `Warm transfer started to ${selectedTarget.name}`
        : `Call transferred to ${selectedTarget.name}`,
    );
    setTransferOpen(false);
    setTransferTarget(null); setTransferNote(""); setTransferQuery("");
    if (transferMode === "cold") { setOnHold(false); }
    else { setOnHold(true); }
  }

  useEffect(() => {
    const t = setTimeout(() => setStatus("in-call"), 1800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (status !== "in-call") return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [status]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const initials = (name ?? number ?? "?")
    .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  function end() {
    setStatus("ended");
    onEndCall();
  }

  return (
    <div className="w-[320px] shrink-0 rounded-[var(--cc-radius-lg)] border border-[color:var(--cc-ink-200)] bg-[color:var(--cc-ink-0)] p-6 shadow-[var(--cc-shadow-md)] flex flex-col items-center text-center">
      <div className="w-full flex justify-end -mt-2 -mr-2">
        <CCButton variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X className="size-4" /></CCButton>
      </div>
      <div className="size-24 rounded-full bg-[color:var(--cc-info)]/10 text-[color:var(--cc-info)] flex items-center justify-center text-2xl font-semibold mb-4">
        {initials}
      </div>
      <div className="text-lg font-semibold">{name ?? "Unknown"}</div>
      <div className="text-sm text-[color:var(--cc-ink-500)] font-mono mt-1">{number}</div>
      <div className="mt-3 text-sm text-[color:var(--cc-ink-500)]">
        {status === "dialing" && (
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-yellow-500 animate-pulse" /> Dialing…
          </span>
        )}
        {status === "in-call" && (
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-green-500" /> In call · {mm}:{ss}
          </span>
        )}
        {status === "ended" && (
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-500" /> Call ended
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6 w-full">
        <CallBtn
          icon={muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          label={muted ? "Unmute" : "Mute"}
          active={muted}
          disabled={status === "ended"}
          onClick={() => setMuted((m) => !m)}
        />
        <CallBtn
          icon={<Pause className="size-5" />}
          label={onHold ? "Resume" : "Hold"}
          active={onHold}
          disabled={status === "ended"}
          onClick={() => setOnHold((h) => !h)}
        />
        <CallBtn
          icon={<PhoneForwarded className="size-5" />}
          label="Transfer"
          disabled={status === "ended"}
          onClick={() => setTransferOpen(true)}
        />
      </div>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm gap-3 p-4">
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="text-base">Transfer call</DialogTitle>
            <DialogDescription className="text-xs">
              Send {name ?? "caller"} ({number}) onward.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setTransferMode("warm")}
              className={`rounded-md border px-2 py-1.5 text-left text-xs ${transferMode === "warm" ? "border-[color:var(--cc-brand)] bg-[color:var(--cc-brand)]/5" : "hover:bg-muted/40"}`}
            >
              <div className="font-medium">Warm</div>
              <div className="text-[11px] text-muted-foreground">Speak first</div>
            </button>
            <button
              type="button"
              onClick={() => setTransferMode("cold")}
              className={`rounded-md border px-2 py-1.5 text-left text-xs ${transferMode === "cold" ? "border-[color:var(--cc-brand)] bg-[color:var(--cc-brand)]/5" : "hover:bg-muted/40"}`}
            >
              <div className="font-medium">Cold</div>
              <div className="text-[11px] text-muted-foreground">Hand off now</div>
            </button>
          </div>

          <input
            value={transferQuery}
            onChange={(e) => setTransferQuery(e.target.value)}
            placeholder="Search agents, teams, extensions…"
            className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[color:var(--cc-brand)]/30"
          />

          <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
            {filteredTargets.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">No matches.</div>
            )}
            {filteredTargets.map((t) => {
              const active = transferTarget === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTransferTarget(t.id)}
                  className={`w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-xs ${active ? "bg-[color:var(--cc-brand)]/5" : "hover:bg-muted/40"}`}
                >
                  <span className={`size-2 rounded-full shrink-0 ${toneDot[t.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{t.detail}</div>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground border rounded px-1 py-0.5">
                    {t.kind}
                  </span>
                </button>
              );
            })}
          </div>

          <textarea
            value={transferNote}
            onChange={(e) => setTransferNote(e.target.value)}
            placeholder="Note for receiver (optional)…"
            rows={2}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[color:var(--cc-brand)]/30"
          />

          <DialogFooter className="gap-2 sm:gap-2">
            <CCButton variant="ghost" onClick={() => setTransferOpen(false)}>Cancel</CCButton>
            <CCButton disabled={!selectedTarget} onClick={confirmTransfer}>
              {transferMode === "warm" ? "Start warm" : "Transfer"}
            </CCButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-6 w-full">
        {status !== "ended" ? (
          <button
            onClick={end}
            className="w-full inline-flex items-center justify-center gap-2 rounded-[var(--cc-radius-md)] bg-red-600 hover:bg-red-700 text-white py-2.5 font-medium transition-colors"
          >
            <PhoneOff className="size-4" /> End call
          </button>
        ) : (
          <CCButton className="w-full" onClick={onClose}>Close</CCButton>
        )}
      </div>
    </div>
  );
}

function CallBtn({
  icon, label, onClick, active, disabled,
}: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-1 rounded-[var(--cc-radius-md)] border py-3 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        active
          ? "bg-[color:var(--cc-info)] text-white border-[color:var(--cc-info)]"
          : "bg-[color:var(--cc-ink-0)] border-[color:var(--cc-ink-200)] hover:bg-[color:var(--cc-ink-100)]",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}