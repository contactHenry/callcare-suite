/**
 * Consent-ledger server fns for the Phase 1 client_consents table.
 * Recording a new consent automatically supersedes the previous record
 * for the same (client, consent_type).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission, audit } from "./permissions.functions";

const STATE = z.enum(["unknown", "granted", "revoked"]);
const CONSENT_TYPE = z.enum([
  "marketing", "calling", "sms", "email", "data_processing", "call_recording",
]);

export const listConsents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: rows, error } = await supabase
      .from("client_consents")
      .select("id, client_id, consent_type, state, source, captured_by, captured_at, evidence_url, notes, superseded_at")
      .eq("client_id", data.clientId)
      .order("captured_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 400 });
    return { consents: rows ?? [] };
  });

export const recordConsent = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:edit")])
  .inputValidator((d: {
    clientId: string; consentType: string; state: string;
    source?: string; evidenceUrl?: string; notes?: string;
  }) =>
    z.object({
      clientId: z.string().uuid(),
      consentType: CONSENT_TYPE,
      state: STATE,
      source: z.string().trim().max(60).optional(),
      evidenceUrl: z.string().trim().url().max(500).optional(),
      notes: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: parent } = await supabase
      .from("contacts").select("organization_id").eq("id", data.clientId).maybeSingle();

    // Supersede the prior live record of the same type
    await supabase.from("client_consents")
      .update({ superseded_at: new Date().toISOString() })
      .eq("client_id", data.clientId)
      .eq("consent_type", data.consentType)
      .is("superseded_at", null);

    const { data: row, error } = await supabase.from("client_consents").insert({
      client_id: data.clientId,
      organization_id: parent?.organization_id ?? null,
      consent_type: data.consentType,
      state: data.state,
      source: data.source ?? "agent_capture",
      captured_by: userId,
      evidence_url: data.evidenceUrl ?? null,
      notes: data.notes ?? null,
    }).select("id").single();
    if (error) throw new Response(error.message, { status: 400 });

    await audit(supabase, userId, "consent.record", "contact", data.clientId, {
      type: data.consentType, state: data.state, source: data.source ?? "agent_capture",
    });
    return { id: row.id as string };
  });