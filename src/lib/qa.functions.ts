/**
 * QA server functions: scorecards (sections + weighted items), reviewer
 * assignment with random call selection, coaching notes, disputes, and
 * agent acknowledgements. Pass/fail is derived from the scorecard's
 * threshold against the weighted overall_score on `qa_reviews`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit } from "./permissions.functions";

/* ----------------------------- Scorecards ----------------------------- */

export const listScorecards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("qa_scorecards")
      .select("*, sections:qa_scorecard_sections(*, items:qa_scorecard_items(*))")
      .order("updated_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const upsertScorecard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    name: string;
    description?: string;
    passThreshold?: number;
    campaignId?: string | null;
    sections: { name: string; items: { prompt: string; weight: number; maxScore: number; isCritical?: boolean }[] }[];
  }) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    passThreshold: z.number().min(0).max(100).optional(),
    campaignId: z.string().uuid().nullish(),
    sections: z.array(z.object({
      name: z.string().min(1).max(160),
      items: z.array(z.object({
        prompt: z.string().min(1).max(500),
        weight: z.number().min(0).max(100),
        maxScore: z.number().int().min(1).max(10),
        isCritical: z.boolean().optional(),
      })),
    })),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      name: data.name,
      description: data.description ?? null,
      pass_threshold: data.passThreshold ?? 80,
      campaign_id: data.campaignId ?? null,
    };
    const { data: card, error } = data.id
      ? await supabase.from("qa_scorecards").update(payload).eq("id", data.id).select().single()
      : await supabase.from("qa_scorecards").insert(payload).select().single();
    if (error) throw new Response(error.message, { status: 500 });

    if (data.id) {
      const { data: existing } = await supabase
        .from("qa_scorecard_sections").select("id").eq("scorecard_id", data.id);
      if (existing?.length) {
        await supabase.from("qa_scorecard_sections")
          .delete().in("id", existing.map((r: { id: string }) => r.id));
      }
    }
    for (let i = 0; i < data.sections.length; i++) {
      const s = data.sections[i];
      const { data: section, error: se } = await supabase.from("qa_scorecard_sections")
        .insert({ scorecard_id: card.id, name: s.name, sort_order: i }).select().single();
      if (se) throw new Response(se.message, { status: 500 });
      if (s.items.length) {
        const rows = s.items.map((it, j) => ({
          section_id: section.id, prompt: it.prompt, weight: it.weight,
          max_score: it.maxScore, is_critical: it.isCritical ?? false, sort_order: j,
        }));
        const { error: ie } = await supabase.from("qa_scorecard_items").insert(rows);
        if (ie) throw new Response(ie.message, { status: 500 });
      }
    }
    await audit(supabase, userId, data.id ? "scorecard.update" : "scorecard.create", "qa_scorecard", card.id, { name: data.name });
    return card;
  });

/* --------------------- Random review assignment ----------------------- */

export const assignRandomReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    reviewerId: string;
    scorecardId: string;
    count?: number;
    sinceDays?: number;
    dueAt?: string;
  }) => z.object({
    reviewerId: z.string().uuid(),
    scorecardId: z.string().uuid(),
    count: z.number().int().min(1).max(50).optional(),
    sinceDays: z.number().int().min(1).max(90).optional(),
    dueAt: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - (data.sinceDays ?? 7) * 86400000).toISOString();
    const { data: pool } = await supabase
      .from("calls").select("id")
      .gte("started_at", since).eq("status", "completed").limit(500);
    const ids = (pool ?? []).map((c: { id: string }) => c.id);
    // Random sample without replacement
    const sample: string[] = [];
    const want = Math.min(data.count ?? 5, ids.length);
    while (sample.length < want && ids.length) {
      const idx = Math.floor(Math.random() * ids.length);
      sample.push(ids.splice(idx, 1)[0]);
    }
    if (!sample.length) return { assigned: 0 };
    const rows = sample.map((cid) => ({
      reviewer_id: data.reviewerId, call_id: cid, scorecard_id: data.scorecardId,
      due_at: data.dueAt ?? null, status: "pending",
    }));
    const { error } = await supabase.from("qa_review_assignments")
      .upsert(rows, { onConflict: "reviewer_id,call_id" });
    if (error) throw new Response(error.message, { status: 500 });
    await audit(supabase, userId, "qa.assign_random", "qa_review_assignment", data.reviewerId, { count: sample.length });
    return { assigned: sample.length };
  });

/* ------------------------- Coaching / disputes ------------------------ */

export const addCoachingNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reviewId: string; body: string; recommendation?: string }) =>
    z.object({
      reviewId: z.string().uuid(),
      body: z.string().min(1).max(4000),
      recommendation: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("qa_coaching_notes").insert({
      review_id: data.reviewId, author_id: userId,
      body: data.body, recommendation: data.recommendation ?? null,
    });
    if (error) throw new Response(error.message, { status: 500 });
    await audit(supabase, userId, "qa.coaching_note", "qa_review", data.reviewId, {});
    return { ok: true };
  });

export const openDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reviewId: string; reason: string }) =>
    z.object({ reviewId: z.string().uuid(), reason: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("qa_disputes").insert({
      review_id: data.reviewId, agent_id: userId, reason: data.reason, status: "open",
    }).select().single();
    if (error) throw new Response(error.message, { status: 500 });
    await audit(supabase, userId, "qa.dispute_open", "qa_review", data.reviewId, {});
    return row;
  });

export const resolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "upheld" | "rejected" | "withdrawn"; note?: string }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["upheld", "rejected", "withdrawn"]),
      note: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("qa_disputes").update({
      status: data.status, moderator_id: userId, moderator_note: data.note ?? null,
      resolved_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    await audit(supabase, userId, "qa.dispute_resolve", "qa_dispute", data.id, { status: data.status });
    return { ok: true };
  });

export const acknowledgeReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reviewId: string }) => z.object({ reviewId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("qa_acknowledgements")
      .upsert({ review_id: data.reviewId, user_id: userId }, { onConflict: "review_id,user_id" });
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

/* ----------------------------- Trends --------------------------------- */

export const qaTrend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { agentId?: string | null; days?: number } | undefined) =>
    z.object({ agentId: z.string().uuid().nullish(), days: z.number().int().min(7).max(180).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - (data.days ?? 30) * 86400000).toISOString();
    const agent = data.agentId ?? userId;
    const { data: reviews } = await supabase
      .from("qa_reviews")
      .select("overall_score, created_at, call:calls!inner(agent_id)")
      .gte("created_at", since)
      .eq("call.agent_id", agent);
    const byDay: Record<string, { sum: number; n: number }> = {};
    for (const r of (reviews ?? []) as Array<{ overall_score: number | null; created_at: string }>) {
      if (r.overall_score == null) continue;
      const day = r.created_at.slice(0, 10);
      byDay[day] ??= { sum: 0, n: 0 };
      byDay[day].sum += Number(r.overall_score);
      byDay[day].n += 1;
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, score: Math.round((v.sum / v.n) * 10) / 10 }));
  });