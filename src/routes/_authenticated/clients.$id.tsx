import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getClient, updateClient, changeStatus, transferClient, listAssignableAgents,
  addClientDocument, deleteClientDocument,
} from "@/lib/clients.functions";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCStatusPill, CCInput, CCSelect, CCField,
} from "@/components/cc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Phone, ArrowLeft, Mail, MapPin, Upload, Trash2, Star, Plus, ShieldCheck } from "lucide-react";
import {
  listContactMethods, addContactMethod, setPrimaryContactMethod, deleteContactMethod,
} from "@/lib/contact-methods.functions";
import { listConsents, recordConsent } from "@/lib/consents.functions";
import { placeOutboundCall } from "@/lib/calls.functions";
import { CallControlBar, RecordingConsentBanner, type CallSession } from "@/components/CallControlBar";
import { getTelephonySettings } from "@/lib/calls.functions";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/clients/$id")({ component: ClientDetail });

/** Status transitions whitelist mirrors the DB function `is_valid_client_transition`. */
const NEXT: Record<string, string[]> = {
  new: ["assigned","unreachable","invalid","do_not_call"],
  assigned: ["contacted","unreachable","do_not_call","closed"],
  contacted: ["follow_up","interested","not_interested","complaint","escalated","do_not_call","closed"],
  follow_up: ["contacted","interested","not_interested","unreachable","escalated","do_not_call","closed"],
  interested: ["converted","follow_up","not_interested","escalated","closed"],
  not_interested: ["closed","do_not_call"],
  unreachable: ["contacted","do_not_call","closed"],
  complaint: ["escalated","closed"],
  escalated: ["closed","converted"],
  invalid: ["closed"],
  do_not_call: ["closed"],
  converted: ["closed"],
  closed: [],
};

const STATUS_TONE: Record<string, "success"|"warning"|"danger"|"info"|"neutral"> = {
  new: "info", assigned: "info", contacted: "info", follow_up: "warning",
  interested: "success", not_interested: "neutral", converted: "success",
  unreachable: "warning", invalid: "danger", complaint: "danger",
  escalated: "danger", do_not_call: "danger", closed: "neutral",
};

function ClientDetail() {
  const { id } = useParams({ from: "/_authenticated/clients/$id" });
  const qc = useQueryClient();
  const { atLeast } = useAuth();
  const getFn = useServerFn(getClient);
  const updateFn = useServerFn(updateClient);
  const statusFn = useServerFn(changeStatus);
  const transferFn = useServerFn(transferClient);
  const agentsFn = useServerFn(listAssignableAgents);
  const addDocFn = useServerFn(addClientDocument);
  const delDocFn = useServerFn(deleteClientDocument);

  const q = useQuery({ queryKey: ["client", id], queryFn: () => getFn({ data: { id } }) });
  const agents = useQuery({ queryKey: ["assignable-agents"], queryFn: () => agentsFn() });

  // Live call state for click-to-call from this profile
  const [session, setSession] = useState<CallSession | null>(null);
  const [telSettings, setTelSettings] = useState<any>(null);
  useEffect(() => { (async () => { try { setTelSettings(await getTelephonySettings()); } catch {} })(); }, []);

  async function startCall(toNumber: string) {
    try {
      const r = await placeOutboundCall({ data: { contactId: id, toNumber } });
      setSession({
        callId: r.callId,
        toNumber,
        contactName: q.data?.client?.name,
        startedAt: new Date().toISOString(),
        direction: "outbound",
        recording: telSettings?.recording_enabled ?? true,
        consentNotice: telSettings?.recording_consent_notice ?? null,
        voicemailDropEnabled: telSettings?.voicemail_drop_enabled ?? false,
      });
    } catch (e: any) { toast.error(e?.message ?? "Could not place call"); }
  }

  if (q.isLoading) return <div className="p-6 text-sm text-[color:var(--cc-ink-500)]">Loading…</div>;
  if (q.isError || !q.data) return <div className="p-6 text-sm text-[color:var(--cc-danger)]">Failed to load client.</div>;

  const c = q.data.client;
  const can = q.data.can;

  return (
    <>
      <PageHeader
        title={c.name}
        description={c.company ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/clients"><CCButton variant="ghost"><ArrowLeft className="size-4 mr-1" />Back</CCButton></Link>
            {c.phone && !session && (
              <CCButton onClick={() => startCall(c.phone!)}>
                <Phone className="size-4 mr-1" />Call {c.phone}
              </CCButton>
            )}
          </div>
        }
      />

      <div className="px-6 py-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* LEFT: profile summary + quick actions */}
        <div className="space-y-4">
          {session && (
            <CallControlBar session={session} onEnded={() => setSession(null)} />
          )}
          {!session && telSettings?.recording_consent_required && (
            <RecordingConsentBanner
              notice={telSettings?.recording_consent_notice}
              required={telSettings?.recording_consent_required}
            />
          )}
          <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <CCStatusPill tone={STATUS_TONE[c.lifecycle_status] ?? "neutral"} dot>
                {(c.lifecycle_status ?? "new").replace("_"," ")}
              </CCStatusPill>
              {c.do_not_call && <CCStatusPill tone="danger">DNC</CCStatusPill>}
            </div>
            <Row icon={<Phone className="size-4" />} label="Primary" value={c.phone} />
            <Row icon={<Phone className="size-4" />} label="Alt" value={c.alt_phone} />
            <Row icon={<Mail  className="size-4" />} label="Email" value={c.email} />
            <Row icon={<MapPin className="size-4" />} label="Address"
              value={can.sensitive
                ? [c.address_line1, c.address_city, c.address_country].filter(Boolean).join(", ") || null
                : "— restricted —"} />
            <Row label="Consent" value={c.consent_status ?? "unknown"} />
            <Row label="Preferred method" value={c.preferred_method ?? "—"} />
            <Row label="Preferred time" value={c.preferred_time ?? "—"} />
            <Row label="Category" value={c.category ?? "—"} />
            <Row label="Source" value={c.campaign_source ?? "—"} />
            <Row label="DOB" value={can.sensitive ? (c.dob ?? "—") : "— restricted —"} />
            <Row label="Last contacted" value={c.last_contacted_at ? new Date(c.last_contacted_at).toLocaleString() : "—"} />
            <Row label="Next follow-up" value={c.next_follow_up_at ? new Date(c.next_follow_up_at).toLocaleString() : "—"} />
          </div>

          <StatusChanger
            current={c.lifecycle_status}
            onSet={async (to, reason) => {
              try { await statusFn({ data: { id, to, reason } }); toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["client", id] }); }
              catch (e: any) { toast.error(e?.message ?? "Failed"); }
            }}
          />

          {atLeast("team_leader") && (
            <Transfer agents={agents.data?.agents ?? []}
              onTransfer={async (toAgentId, reason) => {
                try { await transferFn({ data: { id, toAgentId, reason } }); toast.success("Transferred"); qc.invalidateQueries({ queryKey: ["client", id] }); }
                catch (e: any) { toast.error(e?.message ?? "Failed"); }
              }}
            />
          )}
        </div>

        {/* RIGHT: tabs */}
        <div>
          <Tabs defaultValue="edit">
            <TabsList>
              <TabsTrigger value="edit">Profile</TabsTrigger>
              <TabsTrigger value="channels">Channels</TabsTrigger>
              <TabsTrigger value="consent">Consent</TabsTrigger>
              <TabsTrigger value="timeline">Activity</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="docs">Documents</TabsTrigger>
              <TabsTrigger value="approvals">Approvals</TabsTrigger>
            </TabsList>

            <TabsContent value="edit">
              <EditForm client={c} sensitiveOk={can.sensitive}
                onSave={async (patch) => {
                  try {
                    const res = await updateFn({ data: { id, ...patch } });
                    if (res.queued?.length) toast.message("Sent for approval", { description: res.queued.join(", ") });
                    else toast.success("Saved");
                    qc.invalidateQueries({ queryKey: ["client", id] });
                  } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
                }}
              />
            </TabsContent>

            <TabsContent value="channels">
              <ChannelsPanel clientId={id} />
            </TabsContent>

            <TabsContent value="consent">
              <ConsentPanel clientId={id} />
            </TabsContent>

            <TabsContent value="timeline">
              <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4">
                {q.data.transitions.length === 0 && <p className="text-sm text-[color:var(--cc-ink-500)]">No activity yet.</p>}
                <ul className="space-y-3">
                  {q.data.transitions.map((t: any) => (
                    <li key={t.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-1 size-2 rounded-full bg-[color:var(--cc-info)]" />
                      <div>
                        <div>{(t.from_status ?? "—")} → <strong>{t.to_status}</strong></div>
                        <div className="text-xs text-[color:var(--cc-ink-500)]">{new Date(t.at).toLocaleString()}{t.reason ? ` · ${t.reason}` : ""}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="notes">
              <NotesEditor initial={c.notes ?? ""} onSave={(notes) => updateFn({ data: { id, notes } }).then(() => { toast.success("Notes saved"); qc.invalidateQueries({ queryKey: ["client", id] }); })} />
            </TabsContent>

            <TabsContent value="docs">
              <Documents clientId={id} docs={q.data.documents}
                onUploaded={(payload) => addDocFn({ data: payload }).then(() => qc.invalidateQueries({ queryKey: ["client", id] }))}
                onDelete={(docId) => delDocFn({ data: { id: docId } }).then(() => qc.invalidateQueries({ queryKey: ["client", id] }))}
              />
            </TabsContent>

            <TabsContent value="approvals">
              <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4">
                {q.data.approvals.length === 0 && <p className="text-sm text-[color:var(--cc-ink-500)]">No change requests.</p>}
                <ul className="space-y-2 text-sm">
                  {q.data.approvals.map((a: any) => (
                    <li key={a.id} className="flex items-center justify-between border-b border-[color:var(--cc-ink-100)] pb-2 last:border-b-0">
                      <div>
                        <strong className="capitalize">{a.field}</strong>: {a.old_value ?? "∅"} → {a.new_value ?? "∅"}
                        <div className="text-xs text-[color:var(--cc-ink-500)]">{new Date(a.created_at).toLocaleString()}</div>
                      </div>
                      <CCStatusPill tone={a.state === "pending" ? "warning" : a.state === "approved" ? "success" : "danger"}>{a.state}</CCStatusPill>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {icon && <span className="mt-0.5 text-[color:var(--cc-ink-500)]">{icon}</span>}
      <span className="w-32 text-xs uppercase tracking-wide text-[color:var(--cc-ink-500)]">{label}</span>
      <span className="flex-1 break-words">{value ?? "—"}</span>
    </div>
  );
}

function StatusChanger({ current, onSet }: { current: string; onSet: (to: string, reason?: string) => void }) {
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const options = NEXT[current] ?? [];
  return (
    <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4 space-y-3">
      <div className="text-sm font-medium">Change status</div>
      <CCField label="Next status">
        <CCSelect value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) => <option key={o} value={o}>{o.replace("_"," ")}</option>)}
        </CCSelect>
      </CCField>
      <CCField label="Reason (optional)">
        <CCInput value={reason} onChange={(e) => setReason(e.target.value)} />
      </CCField>
      <CCButton disabled={!to} onClick={() => { onSet(to, reason || undefined); setTo(""); setReason(""); }}>Update</CCButton>
    </div>
  );
}

function Transfer({ agents, onTransfer }: { agents: { id: string; full_name: string | null }[]; onTransfer: (id: string, reason?: string) => void }) {
  const [a, setA] = useState(""); const [r, setR] = useState("");
  return (
    <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4 space-y-3">
      <div className="text-sm font-medium">Transfer to agent</div>
      <CCField label="Agent">
        <CCSelect value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">Select…</option>
          {agents.map((x) => <option key={x.id} value={x.id}>{x.full_name ?? x.id}</option>)}
        </CCSelect>
      </CCField>
      <CCField label="Reason (optional)">
        <CCInput value={r} onChange={(e) => setR(e.target.value)} />
      </CCField>
      <CCButton disabled={!a} onClick={() => { onTransfer(a, r || undefined); setA(""); setR(""); }}>Transfer</CCButton>
    </div>
  );
}

function EditForm({ client, sensitiveOk, onSave }: { client: any; sensitiveOk: boolean; onSave: (patch: any) => void }) {
  const [f, setF] = useState({
    name: client.name ?? "",
    phone: client.phone ?? "",
    alt_phone: client.alt_phone ?? "",
    email: client.email ?? "",
    company: client.company ?? "",
    preferred_method: client.preferred_method ?? "phone",
    preferred_time: client.preferred_time ?? "",
    category: client.category ?? "",
    campaign_source: client.campaign_source ?? "",
    consent_status: client.consent_status ?? "unknown",
    do_not_call: !!client.do_not_call,
    next_follow_up_at: client.next_follow_up_at ? new Date(client.next_follow_up_at).toISOString().slice(0,16) : "",
    dob: client.dob ?? "",
    address_line1: client.address_line1 ?? "",
    address_city: client.address_city ?? "",
    address_country: client.address_country ?? "",
  });
  return (
    <form
      className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4 grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const patch: any = { ...f };
        if (!patch.email) patch.email = null;
        if (!patch.dob) patch.dob = null;
        if (patch.next_follow_up_at) patch.next_follow_up_at = new Date(patch.next_follow_up_at).toISOString();
        else patch.next_follow_up_at = null;
        onSave(patch);
      }}
    >
      <CCField label="Name"><CCInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></CCField>
      <CCField label="Company"><CCInput value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></CCField>
      <CCField label="Primary phone" hint="Edits queue for approval"><CCInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></CCField>
      <CCField label="Alt phone" hint="Edits queue for approval"><CCInput value={f.alt_phone} onChange={(e) => setF({ ...f, alt_phone: e.target.value })} /></CCField>
      <CCField label="Email" hint="Edits queue for approval"><CCInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></CCField>
      <CCField label="Preferred method">
        <CCSelect value={f.preferred_method} onChange={(e) => setF({ ...f, preferred_method: e.target.value })}>
          <option value="phone">Phone</option><option value="email">Email</option>
          <option value="sms">SMS</option><option value="whatsapp">WhatsApp</option>
          <option value="no_contact">No contact</option>
        </CCSelect>
      </CCField>
      <CCField label="Preferred time"><CCInput value={f.preferred_time} onChange={(e) => setF({ ...f, preferred_time: e.target.value })} placeholder="e.g. weekday mornings" /></CCField>
      <CCField label="Category"><CCInput value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></CCField>
      <CCField label="Campaign source"><CCInput value={f.campaign_source} onChange={(e) => setF({ ...f, campaign_source: e.target.value })} /></CCField>
      <CCField label="Consent">
        <CCSelect value={f.consent_status} onChange={(e) => setF({ ...f, consent_status: e.target.value })}>
          <option value="unknown">Unknown</option><option value="granted">Granted</option><option value="revoked">Revoked</option>
        </CCSelect>
      </CCField>
      <CCField label="Next follow-up">
        <CCInput type="datetime-local" value={f.next_follow_up_at} onChange={(e) => setF({ ...f, next_follow_up_at: e.target.value })} />
      </CCField>
      {sensitiveOk && (
        <>
          <CCField label="DOB" hint="Edits queue for approval">
            <CCInput type="date" value={f.dob ?? ""} onChange={(e) => setF({ ...f, dob: e.target.value })} />
          </CCField>
          <CCField label="Address line 1"><CCInput value={f.address_line1} onChange={(e) => setF({ ...f, address_line1: e.target.value })} /></CCField>
          <CCField label="City"><CCInput value={f.address_city} onChange={(e) => setF({ ...f, address_city: e.target.value })} /></CCField>
          <CCField label="Country"><CCInput value={f.address_country} onChange={(e) => setF({ ...f, address_country: e.target.value })} /></CCField>
        </>
      )}
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" checked={f.do_not_call} onChange={(e) => setF({ ...f, do_not_call: e.target.checked })} />
        Mark as Do Not Call
      </label>
      <div className="md:col-span-2 flex justify-end">
        <CCButton type="submit">Save</CCButton>
      </div>
    </form>
  );
}

function NotesEditor({ initial, onSave }: { initial: string; onSave: (notes: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4 space-y-3">
      <textarea
        className="w-full min-h-48 rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] p-3 text-sm"
        value={v} onChange={(e) => setV(e.target.value)} />
      <div className="flex justify-end"><CCButton onClick={() => onSave(v)}>Save notes</CCButton></div>
    </div>
  );
}

function Documents({ clientId, docs, onUploaded, onDelete }:
  { clientId: string; docs: any[]; onUploaded: (p: any) => void; onDelete: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    try {
      const path = `${clientId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("client-documents").upload(path, file, { upsert: false });
      if (error) throw error;
      await onUploaded({ clientId, storagePath: path, filename: file.name, mimeType: file.type, sizeBytes: file.size });
      toast.success("Uploaded");
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4 space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <CCButton type="button" variant="ghost" disabled={busy}>
          <Upload className="size-4 mr-1" />{busy ? "Uploading…" : "Upload file"}
        </CCButton>
        <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} />
      </label>
      {docs.length === 0 && <p className="text-sm text-[color:var(--cc-ink-500)]">No documents yet.</p>}
      <ul className="space-y-1">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between text-sm border-b border-[color:var(--cc-ink-100)] py-1.5 last:border-b-0">
            <div>
              <div className="font-medium">{d.filename}</div>
              <div className="text-xs text-[color:var(--cc-ink-500)]">{d.mime_type ?? ""} · {new Date(d.created_at).toLocaleString()}</div>
            </div>
            <CCButton variant="ghost" size="sm" onClick={() => onDelete(d.id)}><Trash2 className="size-4" /></CCButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------- Channels ----------------------------- */

const METHOD_LABEL: Record<string, string> = {
  phone: "Phone", email: "Email", sms: "SMS", whatsapp: "WhatsApp", no_contact: "No contact",
};

function ChannelsPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listContactMethods);
  const addFn = useServerFn(addContactMethod);
  const primaryFn = useServerFn(setPrimaryContactMethod);
  const delFn = useServerFn(deleteContactMethod);
  const q = useQuery({ queryKey: ["contact-methods", clientId], queryFn: () => listFn({ data: { clientId } }) });
  const [draft, setDraft] = useState({ method: "phone", value: "", label: "", isPrimary: false });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["contact-methods", clientId] });

  return (
    <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4 space-y-4">
      <form
        className="grid gap-3 md:grid-cols-[140px_1fr_140px_auto] items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.value.trim()) return;
          try {
            await addFn({ data: {
              clientId, method: draft.method, value: draft.value.trim(),
              label: draft.label.trim() || undefined, isPrimary: draft.isPrimary,
            }});
            toast.success("Channel added");
            setDraft({ method: draft.method, value: "", label: "", isPrimary: false });
            invalidate();
          } catch (e: any) { toast.error(e?.message ?? "Failed"); }
        }}
      >
        <CCField label="Method">
          <CCSelect value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value })}>
            <option value="phone">Phone</option><option value="email">Email</option>
            <option value="sms">SMS</option><option value="whatsapp">WhatsApp</option>
          </CCSelect>
        </CCField>
        <CCField label="Value">
          <CCInput value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            placeholder={draft.method === "email" ? "name@example.com" : "+44 7700 900123"} />
        </CCField>
        <CCField label="Label (optional)">
          <CCInput value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="mobile / work" />
        </CCField>
        <CCButton type="submit"><Plus className="size-4 mr-1" />Add</CCButton>
        <label className="md:col-span-4 flex items-center gap-2 text-sm -mt-1">
          <input type="checkbox" checked={draft.isPrimary}
            onChange={(e) => setDraft({ ...draft, isPrimary: e.target.checked })} />
          Set as primary for this method
        </label>
      </form>

      <div>
        {q.isLoading && <p className="text-sm text-[color:var(--cc-ink-500)]">Loading channels…</p>}
        {q.data?.methods.length === 0 && (
          <p className="text-sm text-[color:var(--cc-ink-500)]">No channels yet. Add the client's phone or email above.</p>
        )}
        <ul className="divide-y divide-[color:var(--cc-ink-100)]">
          {(q.data?.methods ?? []).map((m: any) => (
            <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
              <div className="flex items-center gap-3">
                {m.method === "email"
                  ? <Mail className="size-4 text-[color:var(--cc-ink-500)]" />
                  : <Phone className="size-4 text-[color:var(--cc-ink-500)]" />}
                <div>
                  <div className="font-medium">{m.value}</div>
                  <div className="text-xs text-[color:var(--cc-ink-500)]">
                    {METHOD_LABEL[m.method]}{m.label ? ` · ${m.label}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.is_primary
                  ? <CCStatusPill tone="success">Primary</CCStatusPill>
                  : <CCButton variant="ghost" size="sm"
                      onClick={async () => { await primaryFn({ data: { id: m.id } }); invalidate(); }}>
                      <Star className="size-4 mr-1" />Make primary
                    </CCButton>}
                <CCButton variant="ghost" size="sm"
                  onClick={async () => {
                    if (!confirm("Delete this channel?")) return;
                    await delFn({ data: { id: m.id } }); invalidate();
                  }}>
                  <Trash2 className="size-4" />
                </CCButton>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ----------------------------- Consent ----------------------------- */

const CONSENT_TYPES = [
  { value: "marketing", label: "Marketing" },
  { value: "calling", label: "Calling (DNC)" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "call_recording", label: "Call recording" },
  { value: "data_processing", label: "Data processing" },
];

const STATE_TONE: Record<string, "success"|"warning"|"danger"|"neutral"> = {
  granted: "success", revoked: "danger", unknown: "neutral",
};

function ConsentPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listConsents);
  const recordFn = useServerFn(recordConsent);
  const q = useQuery({ queryKey: ["consents", clientId], queryFn: () => listFn({ data: { clientId } }) });
  const [draft, setDraft] = useState({ consentType: "marketing", state: "granted", source: "agent_capture", notes: "" });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["consents", clientId] });
  const live = (q.data?.consents ?? []).filter((c: any) => !c.superseded_at);
  const history = (q.data?.consents ?? []).filter((c: any) => c.superseded_at);

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4" />Current consent
        </div>
        {live.length === 0 && <p className="text-sm text-[color:var(--cc-ink-500)]">No consent on record.</p>}
        <ul className="divide-y divide-[color:var(--cc-ink-100)]">
          {live.map((c: any) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <div className="font-medium capitalize">{c.consent_type.replace("_"," ")}</div>
                <div className="text-xs text-[color:var(--cc-ink-500)]">
                  {c.source ?? "—"} · {new Date(c.captured_at).toLocaleString()}
                </div>
              </div>
              <CCStatusPill tone={STATE_TONE[c.state]}>{c.state}</CCStatusPill>
            </li>
          ))}
        </ul>
      </div>

      <form
        className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await recordFn({ data: {
              clientId,
              consentType: draft.consentType,
              state: draft.state,
              source: draft.source.trim() || undefined,
              notes: draft.notes.trim() || undefined,
            }});
            toast.success("Consent recorded");
            setDraft({ ...draft, notes: "" });
            invalidate();
          } catch (e: any) { toast.error(e?.message ?? "Failed"); }
        }}
      >
        <CCField label="Type">
          <CCSelect value={draft.consentType} onChange={(e) => setDraft({ ...draft, consentType: e.target.value })}>
            {CONSENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </CCSelect>
        </CCField>
        <CCField label="State">
          <CCSelect value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })}>
            <option value="granted">Granted</option>
            <option value="revoked">Revoked</option>
            <option value="unknown">Unknown</option>
          </CCSelect>
        </CCField>
        <CCField label="Source">
          <CCInput value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            placeholder="agent_capture / web_form / import" />
        </CCField>
        <CCButton type="submit">Record</CCButton>
        <CCField label="Notes (optional)" className="md:col-span-4">
          <CCInput value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </CCField>
      </form>

      {history.length > 0 && (
        <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4">
          <div className="text-sm font-medium mb-2">History</div>
          <ul className="divide-y divide-[color:var(--cc-ink-100)]">
            {history.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm text-[color:var(--cc-ink-500)]">
                <div>
                  <span className="capitalize">{c.consent_type.replace("_"," ")}</span> · {c.state}
                </div>
                <span className="text-xs">{new Date(c.captured_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}