/**
 * Workflow layer server functions: configurable call outcomes,
 * after-call notes, and tasks / follow-ups.
 *
 * All writes audit-log via `audit()`; RLS in the DB scopes reads.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit } from "./permissions.functions";

const PRIORITY = z.enum(["low", "normal", "high", "urgent"]);
const TASK_STATUS = z.enum(["open", "in_progress", "completed", "cancelled", "escalated"]);
const TASK_KIND = z.enum(["follow_up", "callback", "admin", "coaching", "escalation", "other"]);

/* ------------------------- Outcome definitions ------------------------- */

export const listOutcomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId?: string | null } | undefined) =>
    z.object({ campaignId: z.string().uuid().nullish() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("call_outcome_definitions")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (data.campaignId) q = q.eq("campaign_id", data.campaignId);
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

export const upsertOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    campaignId?: string | null;
    code: string;
    label: string;
    polarity: "positive" | "neutral" | "negative";
    requiresFollowUp?: boolean;
    sortOrder?: number;
    isActive?: boolean;
  }) => z.object({
    id: z.string().uuid().optional(),
    campaignId: z.string().uuid().nullish(),
    code: z.string().min(1).max(48),
    label: z.string().min(1).max(120),
    polarity: z.enum(["positive", "neutral", "negative"]),
    requiresFollowUp: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      campaign_id: data.campaignId ?? null,
      code: data.code,
      label: data.label,
      polarity: data.polarity,
      requires_follow_up: data.requiresFollowUp ?? false,
      sort_order: data.sortOrder ?? 0,
      is_active: data.isActive ?? true,
    };
    const { data: row, error } = data.id
      ? await supabase.from("call_outcome_definitions").update(payload).eq("id", data.id).select().single()
      : await supabase.from("call_outcome_definitions").insert(payload).select().single();
    if (error) throw new Response(error.message, { status: 500 });
    await audit(supabase, userId, data.id ? "outcome.update" : "outcome.create", "call_outcome", row.id, payload);
    return row;
  });

/* ---------------------------- After-call notes ------------------------ */

export const saveCallNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    callId: string;
    outcomeCode?: string;
    summary?: string;
    concerns?: string;
    actionRequired?: string;
    priority?: "low" | "normal" | "high" | "urgent";
    complaint?: boolean;
    consentUpdate?: string;
    nextAction?: string;
    followUp?: { dueAt: string; assigneeId?: string | null; title?: string } | null;
  }) => z.object({
    callId: z.string().uuid(),
    outcomeCode: z.string().max(48).optional(),
    summary: z.string().max(4000).optional(),
    concerns: z.string().max(2000).optional(),
    actionRequired: z.string().max(2000).optional(),
    priority: PRIORITY.optional(),
    complaint: z.boolean().optional(),
    consentUpdate: z.string().max(200).optional(),
    nextAction: z.string().max(500).optional(),
    followUp: z.object({
      dueAt: z.string(),
      assigneeId: z.string().uuid().nullish(),
      title: z.string().max(200).optional(),
    }).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let followUpTaskId: string | null = null;
    if (data.followUp) {
      const { data: call } = await supabase.from("calls")
        .select("contact_id, campaign_id, organization_id")
        .eq("id", data.callId).maybeSingle();
      const { data: task, error: te } = await supabase.from("tasks").insert({
        title: data.followUp.title ?? "Follow-up callback",
        kind: "follow_up",
        priority: data.priority ?? "normal",
        client_id: call?.contact_id ?? null,
        call_id: data.callId,
        campaign_id: call?.campaign_id ?? null,
        organization_id: call?.organization_id ?? null,
        assigned_to: data.followUp.assigneeId ?? userId,
        created_by: userId,
        due_at: data.followUp.dueAt,
        remind_at: data.followUp.dueAt,
      }).select("id").single();
      if (te) throw new Response(te.message, { status: 500 });
      followUpTaskId = task.id;
    }

    const { data: row, error } = await supabase.from("call_notes").insert({
      call_id: data.callId,
      agent_id: userId,
      outcome_code: data.outcomeCode ?? null,
      summary: data.summary ?? null,
      concerns: data.concerns ?? null,
      action_required: data.actionRequired ?? null,
      priority: data.priority ?? "normal",
      complaint: data.complaint ?? false,
      consent_update: data.consentUpdate ?? null,
      next_action: data.nextAction ?? null,
      follow_up_task_id: followUpTaskId,
    }).select().single();
    if (error) throw new Response(error.message, { status: 500 });
    await audit(supabase, userId, "call_note.create", "call_note", row.id, {
      callId: data.callId, outcome: data.outcomeCode, complaint: data.complaint,
    });
    return row;
  });

/* --------------------------------- Tasks ------------------------------ */

export const listTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    scope?: "mine" | "team" | "all";
    status?: string[];
    overdueOnly?: boolean;
    limit?: number;
  } | undefined) => z.object({
    scope: z.enum(["mine", "team", "all"]).optional(),
    status: z.array(TASK_STATUS).optional(),
    overdueOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("tasks")
      .select("*, client:contacts(id,name,phone), assignee:profiles!tasks_assigned_to_fkey(id,full_name)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(data.limit ?? 200);
    if ((data.scope ?? "mine") === "mine") q = q.eq("assigned_to", userId);
    if (data.status?.length) q = q.in("status", data.status);
    if (data.overdueOnly) q = q.lt("due_at", new Date().toISOString()).neq("status", "completed");
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    title: string;
    description?: string;
    kind?: "follow_up" | "callback" | "admin" | "coaching" | "escalation" | "other";
    priority?: "low" | "normal" | "high" | "urgent";
    clientId?: string | null;
    callId?: string | null;
    assignedTo?: string | null;
    dueAt?: string | null;
    recurrenceRule?: string | null;
  }) => z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    kind: TASK_KIND.optional(),
    priority: PRIORITY.optional(),
    clientId: z.string().uuid().nullish(),
    callId: z.string().uuid().nullish(),
    assignedTo: z.string().uuid().nullish(),
    dueAt: z.string().nullish(),
    recurrenceRule: z.string().max(200).nullish(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("tasks").insert({
      title: data.title,
      description: data.description ?? null,
      kind: data.kind ?? "follow_up",
      priority: data.priority ?? "normal",
      client_id: data.clientId ?? null,
      call_id: data.callId ?? null,
      assigned_to: data.assignedTo ?? userId,
      created_by: userId,
      due_at: data.dueAt ?? null,
      recurrence_rule: data.recurrenceRule ?? null,
    }).select().single();
    if (error) throw new Response(error.message, { status: 500 });
    await audit(supabase, userId, "task.create", "task", row.id, { title: data.title });
    return row;
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "open" | "in_progress" | "completed" | "cancelled" | "escalated"; note?: string }) =>
    z.object({ id: z.string().uuid(), status: TASK_STATUS, note: z.string().max(1000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = {
      status: data.status,
      completed_at: data.status === "completed" ? new Date().toISOString() : null,
      completion_note: data.status === "completed" ? (data.note ?? null) : null,
      escalated: data.status === "escalated",
    };
    const { error } = await supabase.from("tasks").update(patch).eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    await audit(supabase, userId, "task.status_change", "task", data.id, { status: data.status });
    return { ok: true };
  });

export const addTaskComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string; body: string }) =>
    z.object({ taskId: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("task_comments").insert({
      task_id: data.taskId, author_id: userId, body: data.body,
    }).select().single();
    if (error) throw new Response(error.message, { status: 500 });
    return row;
  });

/* ----------------------- Pre-call follow-up alerts -------------------- */

export const upcomingFollowUps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { windowMinutes?: number } | undefined) =>
    z.object({ windowMinutes: z.number().int().min(5).max(1440).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const horizon = new Date(Date.now() + (data.windowMinutes ?? 60) * 60_000).toISOString();
    const { data: rows, error } = await supabase
      .from("tasks")
      .select("id,title,due_at,priority,client:contacts(id,name,phone)")
      .eq("assigned_to", userId)
      .eq("status", "open")
      .lte("due_at", horizon)
      .order("due_at", { ascending: true })
      .limit(20);
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });