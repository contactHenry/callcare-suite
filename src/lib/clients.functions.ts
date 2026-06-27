/**
 * Client management server functions.
 *
 * Read endpoints rely on RLS to scope rows (agents see assigned/owned,
 * team leaders see their team, supervisors+ see the org). Writes go
 * through `requirePermission` and emit audit-log entries. Sensitive
 * fields (DOB, address) are blanked out in read responses unless the
 * caller holds `clients:view_sensitive`. Edits to phone/email queue a
 * supervisor approval instead of writing directly.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission, audit } from "./permissions.functions";

const STATUS = z.enum([
  "new","assigned","contacted","follow_up","interested","not_interested",
  "converted","unreachable","invalid","complaint","escalated","do_not_call","closed",
]);
const METHOD = z.enum(["phone","email","sms","whatsapp","no_contact"]);
const CONSENT = z.enum(["unknown","granted","revoked"]);

const SENSITIVE_FIELDS = ["dob","address_line1","address_line2","address_city","address_region","address_postcode","address_country"] as const;
const APPROVAL_FIELDS  = new Set(["phone","alt_phone","email","dob"]);

function redactSensitive<T extends Record<string, any>>(row: T): T {
  const out: any = { ...row };
  for (const f of SENSITIVE_FIELDS) out[f] = null;
  out._sensitive_redacted = true;
  return out;
}

async function canSeeSensitive(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_permission", { _user_id: userId, _permission: "clients:view_sensitive" });
  return !!data;
}

/* ------------------------------ LIST ------------------------------ */

export const listClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    search?: string;
    status?: string[];
    assignedAgentId?: string | null;
    teamId?: string | null;
    consent?: string;
    doNotCall?: boolean | null;
    tags?: string[];
    sort?: "name" | "created" | "last_contacted" | "next_follow_up";
    direction?: "asc" | "desc";
    page?: number;
    pageSize?: number;
  } | undefined) => z.object({
    search: z.string().trim().max(120).optional(),
    status: z.array(STATUS).optional(),
    assignedAgentId: z.string().uuid().nullable().optional(),
    teamId: z.string().uuid().nullable().optional(),
    consent: CONSENT.optional(),
    doNotCall: z.boolean().nullable().optional(),
    tags: z.array(z.string().max(40)).max(10).optional(),
    sort: z.enum(["name","created","last_contacted","next_follow_up"]).default("created"),
    direction: z.enum(["asc","desc"]).default("desc"),
    page: z.number().int().min(1).max(10000).default(1),
    pageSize: z.number().int().min(10).max(200).default(50),
  }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const sortColumn = { name: "name", created: "created_at", last_contacted: "last_contacted_at", next_follow_up: "next_follow_up_at" }[data.sort];
    let q = supabase
      .from("contacts")
      .select("id,name,phone,alt_phone,email,company,lifecycle_status,assigned_agent_id,assigned_team_id,campaign_source,consent_status,do_not_call,tags,last_contacted_at,next_follow_up_at,created_at,dob,address_line1,address_city,address_country", { count: "exact" })
      .is("deleted_at", null)
      .order(sortColumn, { ascending: data.direction === "asc", nullsFirst: false });
    if (data.search) {
      const s = data.search.replace(/[%_]/g, " ").trim();
      q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,company.ilike.%${s}%`);
    }
    if (data.status?.length) q = q.in("lifecycle_status", data.status);
    if (data.assignedAgentId !== undefined && data.assignedAgentId !== null) q = q.eq("assigned_agent_id", data.assignedAgentId);
    if (data.teamId !== undefined && data.teamId !== null) q = q.eq("assigned_team_id", data.teamId);
    if (data.consent) q = q.eq("consent_status", data.consent);
    if (data.doNotCall !== undefined && data.doNotCall !== null) q = q.eq("do_not_call", data.doNotCall);
    if (data.tags?.length) q = q.contains("tags", data.tags);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, count, error } = await q.range(from, to);
    if (error) throw new Response(error.message, { status: 400 });
    const sensitiveOk = await canSeeSensitive(supabase, userId);
    const out = (rows ?? []).map((r: any) => sensitiveOk ? r : redactSensitive(r));
    return { rows: out, total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

/* ------------------------------ GET ------------------------------- */

export const getClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: row, error } = await supabase.from("contacts").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Response(error.message, { status: 400 });
    if (!row) throw new Response("Not found", { status: 404 });
    const [transitions, approvals, documents] = await Promise.all([
      supabase.from("client_status_transitions").select("*").eq("client_id", data.id).order("at", { ascending: false }).limit(50),
      supabase.from("client_change_approvals").select("*").eq("client_id", data.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("client_documents").select("*").eq("client_id", data.id).order("created_at", { ascending: false }),
    ]);
    const sensitiveOk = await canSeeSensitive(supabase, userId);
    return {
      client: sensitiveOk ? row : redactSensitive(row),
      transitions: transitions.data ?? [],
      approvals: approvals.data ?? [],
      documents: documents.data ?? [],
      can: { sensitive: sensitiveOk },
    };
  });

/* --------------------------- CREATE / UPDATE ---------------------- */

const CLIENT_INPUT = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).nullable().optional(),
  alt_phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional().or(z.literal("").transform(() => null)),
  company: z.string().trim().max(160).nullable().optional(),
  address_line1: z.string().trim().max(200).nullable().optional(),
  address_line2: z.string().trim().max(200).nullable().optional(),
  address_city: z.string().trim().max(120).nullable().optional(),
  address_region: z.string().trim().max(120).nullable().optional(),
  address_postcode: z.string().trim().max(40).nullable().optional(),
  address_country: z.string().trim().max(80).nullable().optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  preferred_method: METHOD.optional(),
  preferred_time: z.string().trim().max(80).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  campaign_source: z.string().trim().max(120).nullable().optional(),
  consent_status: CONSENT.optional(),
  do_not_call: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  assigned_agent_id: z.string().uuid().nullable().optional(),
  assigned_team_id: z.string().uuid().nullable().optional(),
  next_follow_up_at: z.string().datetime().nullable().optional(),
});

export const createClient = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:write_assigned")])
  .inputValidator((data: any) => CLIENT_INPUT.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    const insert = {
      ...data,
      owner_id: userId,
      organization_id: profile?.organization_id ?? null,
      assigned_agent_id: data.assigned_agent_id ?? userId,
      lifecycle_status: data.assigned_agent_id ? "assigned" : "new",
    };
    const { data: row, error } = await supabase.from("contacts").insert(insert).select("id").single();
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "client.create", "client", row.id, { name: data.name });
    return { id: row.id };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:write_assigned")])
  .inputValidator((data: any) => z.object({ id: z.string().uuid() }).merge(CLIENT_INPUT.partial()).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { id, ...patch } = data as any;
    // Strip status; status changes go through changeStatus
    delete patch.lifecycle_status;
    // Sensitive/approval-gated fields: route to approval queue UNLESS caller has approve permission
    const { data: canApprove } = await supabase.rpc("has_permission", { _user_id: userId, _permission: "clients:approve_changes" });
    const direct: Record<string, any> = {};
    const queued: Array<{ field: string; old: any; next: any }> = [];
    const { data: existing } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
    if (!existing) throw new Response("Not found", { status: 404 });
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (APPROVAL_FIELDS.has(k) && !canApprove && existing[k] !== v && existing[k] != null) {
        queued.push({ field: k, old: existing[k], next: v });
      } else {
        direct[k] = v;
      }
    }
    if (Object.keys(direct).length) {
      const { error } = await supabase.from("contacts").update(direct).eq("id", id);
      if (error) throw new Response(error.message, { status: 400 });
      await audit(supabase, userId, "client.update", "client", id, direct);
    }
    if (queued.length) {
      const rows = queued.map((q) => ({
        client_id: id, requested_by: userId, field: q.field,
        old_value: q.old == null ? null : String(q.old),
        new_value: q.next == null ? null : String(q.next),
      }));
      await supabase.from("client_change_approvals").insert(rows);
      await audit(supabase, userId, "client.change_requested", "client", id, { fields: queued.map((q) => q.field) });
    }
    return { ok: true, queued: queued.map((q) => q.field) };
  });

/* ---------------------------- STATUS ------------------------------ */

export const changeStatus = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:write_assigned")])
  .inputValidator((data: { id: string; to: string; reason?: string }) =>
    z.object({ id: z.string().uuid(), to: STATUS, reason: z.string().max(500).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const patch: any = { lifecycle_status: data.to };
    if (data.to === "contacted") patch.last_contacted_at = new Date().toISOString();
    if (data.to === "do_not_call") patch.do_not_call = true;
    const { error } = await supabase.from("contacts").update(patch).eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    if (data.reason) {
      await supabase.from("client_status_transitions").update({ reason: data.reason })
        .eq("client_id", data.id).order("at", { ascending: false }).limit(1);
    }
    await audit(supabase, userId, "client.status", "client", data.id, { to: data.to, reason: data.reason ?? null });
    return { ok: true };
  });

/* ----------------------- ASSIGN / TRANSFER ------------------------ */

export const bulkAssign = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:bulk_assign")])
  .inputValidator((data: { ids: string[]; agentId?: string | null; teamId?: string | null }) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      agentId: z.string().uuid().nullable().optional(),
      teamId: z.string().uuid().nullable().optional(),
    }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const patch: any = {};
    if (data.agentId !== undefined) patch.assigned_agent_id = data.agentId;
    if (data.teamId !== undefined) patch.assigned_team_id = data.teamId;
    if (!Object.keys(patch).length) throw new Response("Nothing to assign", { status: 400 });
    // promote new → assigned when an agent is set
    if (data.agentId) {
      await supabase.from("contacts").update({ lifecycle_status: "assigned" })
        .in("id", data.ids).eq("lifecycle_status", "new");
    }
    const { error } = await supabase.from("contacts").update(patch).in("id", data.ids);
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "client.bulk_assign", "client", `${data.ids.length}`, { ...patch, count: data.ids.length });
    return { ok: true, count: data.ids.length };
  });

export const transferClient = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:transfer")])
  .inputValidator((data: { id: string; toAgentId: string; reason?: string }) =>
    z.object({ id: z.string().uuid(), toAgentId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: prev } = await supabase.from("contacts").select("assigned_agent_id").eq("id", data.id).maybeSingle();
    const { error } = await supabase.from("contacts").update({ assigned_agent_id: data.toAgentId }).eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "client.transfer", "client", data.id, {
      from: prev?.assigned_agent_id ?? null, to: data.toAgentId, reason: data.reason ?? null,
    });
    return { ok: true };
  });

/* ---------------------------- APPROVALS --------------------------- */

export const listApprovals = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:approve_changes")])
  .inputValidator((data: { state?: "pending" | "approved" | "rejected" | "cancelled" } | undefined) =>
    z.object({ state: z.enum(["pending","approved","rejected","cancelled"]).default("pending") }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: rows, error } = await supabase
      .from("client_change_approvals")
      .select("*, contacts:client_id(name)")
      .eq("state", data.state)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Response(error.message, { status: 400 });
    return { rows: rows ?? [] };
  });

export const reviewApproval = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:approve_changes")])
  .inputValidator((data: { id: string; decision: "approve" | "reject"; note?: string }) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approve","reject"]), note: z.string().max(500).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: row, error: e1 } = await supabase.from("client_change_approvals").select("*").eq("id", data.id).maybeSingle();
    if (e1) throw new Response(e1.message, { status: 400 });
    if (!row || row.state !== "pending") throw new Response("Already reviewed", { status: 400 });
    if (data.decision === "approve") {
      const patch: Record<string, any> = { [row.field]: row.new_value };
      const { error: e2 } = await supabase.from("contacts").update(patch).eq("id", row.client_id);
      if (e2) throw new Response(e2.message, { status: 400 });
    }
    await supabase.from("client_change_approvals").update({
      state: data.decision === "approve" ? "approved" : "rejected",
      reviewed_by: userId, reviewed_at: new Date().toISOString(), review_note: data.note ?? null,
    }).eq("id", data.id);
    await audit(supabase, userId, `client.change.${data.decision}`, "client", row.client_id, {
      field: row.field, new_value: row.new_value,
    });
    return { ok: true };
  });

/* ---------------------------- DUPLICATES -------------------------- */

export const findDuplicates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("contacts")
      .select("id,name,phone,email,created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Response(error.message, { status: 400 });
    const buckets = new Map<string, any[]>();
    for (const r of data ?? []) {
      const keys = [
        r.phone && `p:${r.phone.replace(/\D/g, "").slice(-10)}`,
        r.email && `e:${r.email.toLowerCase()}`,
      ].filter(Boolean) as string[];
      for (const k of keys) {
        const arr = buckets.get(k) ?? [];
        arr.push(r); buckets.set(k, arr);
      }
    }
    const groups = [...buckets.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([key, rows]) => ({ key, rows }));
    return { groups };
  });

export const mergeClients = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:merge")])
  .inputValidator((data: { survivingId: string; mergedIds: string[] }) =>
    z.object({ survivingId: z.string().uuid(), mergedIds: z.array(z.string().uuid()).min(1).max(20) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: snapshot } = await supabase.from("contacts").select("*").in("id", data.mergedIds);
    // Repoint calls
    await supabase.from("calls").update({ contact_id: data.survivingId }).in("contact_id", data.mergedIds);
    // Soft-delete merged
    await supabase.from("contacts").update({ deleted_at: new Date().toISOString(), merged_into_id: data.survivingId })
      .in("id", data.mergedIds);
    await supabase.from("client_merges").insert(
      data.mergedIds.map((mid) => ({ surviving_id: data.survivingId, merged_id: mid, merged_by: userId,
        snapshot: snapshot?.find((s: any) => s.id === mid) ?? {} })),
    );
    await audit(supabase, userId, "client.merge", "client", data.survivingId, { merged: data.mergedIds });
    return { ok: true, merged: data.mergedIds.length };
  });

/* ------------------------------ IMPORT ---------------------------- */

const IMPORT_ROW = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(255).optional().or(z.literal("").transform(() => undefined)),
  company: z.string().trim().max(160).optional().nullable(),
  campaign_source: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const importClients = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:import")])
  .inputValidator((data: { rows: any[] }) =>
    z.object({ rows: z.array(z.any()).min(1).max(5000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    const valid: any[] = [];
    const errors: { row: number; error: string }[] = [];
    data.rows.forEach((r, i) => {
      const res = IMPORT_ROW.safeParse(r);
      if (!res.success) errors.push({ row: i + 1, error: res.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ') });
      else valid.push({
        ...res.data, owner_id: userId,
        organization_id: profile?.organization_id ?? null,
        assigned_agent_id: userId,
        lifecycle_status: "assigned",
      });
    });
    let inserted = 0;
    if (valid.length) {
      // chunk inserts
      for (let i = 0; i < valid.length; i += 500) {
        const chunk = valid.slice(i, i + 500);
        const { error } = await supabase.from("contacts").insert(chunk);
        if (error) errors.push({ row: i + 1, error: error.message });
        else inserted += chunk.length;
      }
    }
    await audit(supabase, userId, "client.import", "client", `${inserted}`, { inserted, failed: errors.length });
    return { inserted, errors };
  });

/* ------------------------------ EXPORT ---------------------------- */

export const exportClients = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:export")])
  .inputValidator((data: { ids?: string[] } | undefined) =>
    z.object({ ids: z.array(z.string().uuid()).max(10000).optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    let q = supabase.from("contacts")
      .select("id,name,phone,email,company,lifecycle_status,assigned_agent_id,consent_status,do_not_call,created_at,last_contacted_at")
      .is("deleted_at", null).limit(10000);
    if (data.ids?.length) q = q.in("id", data.ids);
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });
    const headers = ["id","name","phone","email","company","status","assigned_agent","consent","do_not_call","created_at","last_contacted_at"];
    const esc = (v: any) => v == null ? "" : `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...(rows ?? []).map((r: any) => [
      r.id, r.name, r.phone, r.email, r.company, r.lifecycle_status, r.assigned_agent_id,
      r.consent_status, r.do_not_call, r.created_at, r.last_contacted_at,
    ].map(esc).join(","))].join("\n");
    await audit(supabase, userId, "client.export", "client", `${rows?.length ?? 0}`, { count: rows?.length ?? 0 });
    return { csv, count: rows?.length ?? 0 };
  });

/* ---------------------------- DOCUMENTS --------------------------- */

export const addClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clientId: string; storagePath: string; filename: string; mimeType?: string; sizeBytes?: number }) =>
    z.object({
      clientId: z.string().uuid(),
      storagePath: z.string().min(1).max(500),
      filename: z.string().min(1).max(200),
      mimeType: z.string().max(120).optional(),
      sizeBytes: z.number().int().nonnegative().optional(),
    }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: row, error } = await supabase.from("client_documents").insert({
      client_id: data.clientId, uploaded_by: userId,
      storage_path: data.storagePath, filename: data.filename,
      mime_type: data.mimeType ?? null, size_bytes: data.sizeBytes ?? null,
    }).select("id").single();
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "client.doc.add", "client", data.clientId, { filename: data.filename });
    return { id: row.id };
  });

export const deleteClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: doc } = await supabase.from("client_documents").select("client_id,storage_path").eq("id", data.id).maybeSingle();
    const { error } = await supabase.from("client_documents").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    if (doc?.storage_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("client-documents").remove([doc.storage_path]);
    }
    await audit(supabase, userId, "client.doc.delete", "client", doc?.client_id ?? data.id, {});
    return { ok: true };
  });

/* ---------------------------- AGENT LIST -------------------------- */

/** Lightweight agent list for assignment dropdowns. */
export const listAssignableAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true });
    if (error) throw new Response(error.message, { status: 400 });
    return { agents: data ?? [] };
  });