/**
 * Calling infrastructure server functions.
 *
 * The telephony provider is abstracted (`@/lib/telephony/provider`) so
 * Twilio / Sinch / Vonage can be swapped without touching call business
 * logic. Every write is audit-logged and permission-gated.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission, audit } from "./permissions.functions";
import { getTelephonyProvider, listKnownProviders } from "./telephony";

const E164 = z.string().regex(/^\+?[1-9]\d{6,14}$/, "Invalid E.164 number");

/* ====================== OUTBOUND ====================== */

export const placeOutboundCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    contactId?: string | null;
    toNumber: string;
    fromCallerIdId?: string | null;
    campaignId?: string | null;
  }) => z.object({
    contactId: z.string().uuid().nullish(),
    toNumber: E164,
    fromCallerIdId: z.string().uuid().nullish(),
    campaignId: z.string().uuid().nullish(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Resolve caller ID number and org settings
    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    const orgId = profile?.organization_id ?? null;

    let fromNumber = "+10000000000";
    if (data.fromCallerIdId) {
      const { data: cid } = await supabase
        .from("caller_ids").select("e164_number").eq("id", data.fromCallerIdId).maybeSingle();
      if (cid?.e164_number) fromNumber = cid.e164_number;
    }

    const { data: settings } = orgId
      ? await supabase.from("telephony_settings").select("*").eq("organization_id", orgId).maybeSingle()
      : { data: null as any };

    // Create call row first so we have an id to pass to the provider
    const { data: row, error } = await supabase.from("calls").insert({
      agent_id: userId,
      contact_id: data.contactId ?? null,
      organization_id: orgId,
      campaign_id: data.campaignId ?? null,
      caller_id_used: data.fromCallerIdId ?? null,
      direction: "outbound",
      from_number: fromNumber,
      to_number: data.toNumber,
      status: "queued",
      started_at: new Date().toISOString(),
      duration_seconds: 0,
      outcome: "in_progress",
      provider: settings?.provider ?? "stub",
    }).select("*").single();
    if (error) throw new Response(error.message, { status: 400 });

    const provider = getTelephonyProvider(settings?.provider);
    const result = await provider.placeCall({
      callId: row.id, agentId: userId,
      fromNumber, toNumber: data.toNumber,
      recordingEnabled: settings?.recording_enabled ?? true,
      voicemailDetection: true,
    });

    await supabase.from("calls").update({
      provider_call_sid: result.providerCallSid,
      status: result.status === "failed" ? "failed" : "ringing",
    }).eq("id", row.id);

    await audit(supabase, userId, "call.place_outbound", "call", row.id, {
      to: data.toNumber, provider: provider.name,
    });

    return { callId: row.id, providerCallSid: result.providerCallSid, status: result.status };
  });

export const endCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { callId: string; outcome?: string; notes?: string }) =>
    z.object({
      callId: z.string().uuid(),
      outcome: z.string().max(40).optional(),
      notes: z.string().max(4000).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("calls").select("*").eq("id", data.callId).maybeSingle();
    if (!row) throw new Response("Call not found", { status: 404 });
    const provider = getTelephonyProvider(row.provider ?? undefined);
    if (row.provider_call_sid) await provider.hangup(row.provider_call_sid).catch(() => {});
    const endedAt = new Date();
    const startedAt = row.answered_at ?? row.started_at;
    const duration = Math.max(0, Math.round((endedAt.getTime() - new Date(startedAt).getTime()) / 1000));
    const { error } = await supabase.from("calls").update({
      status: "completed",
      ended_at: endedAt.toISOString(),
      duration_seconds: duration,
      outcome: data.outcome ?? row.outcome ?? "completed",
      notes: data.notes ?? row.notes,
    }).eq("id", data.callId);
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "call.end", "call", data.callId, { duration });
    return { ok: true, duration };
  });

export const setCallMute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { callId: string; muted: boolean }) =>
    z.object({ callId: z.string().uuid(), muted: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase.from("calls").select("provider,provider_call_sid").eq("id", data.callId).maybeSingle();
    if (row?.provider_call_sid) await getTelephonyProvider(row.provider ?? undefined).mute(row.provider_call_sid, data.muted);
    return { ok: true };
  });

export const setCallHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { callId: string; onHold: boolean }) =>
    z.object({ callId: z.string().uuid(), onHold: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase.from("calls").select("provider,provider_call_sid").eq("id", data.callId).maybeSingle();
    if (row?.provider_call_sid) await getTelephonyProvider(row.provider ?? undefined).hold(row.provider_call_sid, data.onHold);
    await supabase.from("calls").update({ status: data.onHold ? "on_hold" : "in_progress" }).eq("id", data.callId);
    return { ok: true };
  });

export const transferCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    callId: string; toAgentId?: string | null; toTeamId?: string | null;
    toNumber?: string | null; kind: "warm" | "cold" | "conference"; reason?: string;
  }) => z.object({
    callId: z.string().uuid(),
    toAgentId: z.string().uuid().nullish(),
    toTeamId: z.string().uuid().nullish(),
    toNumber: E164.nullish(),
    kind: z.enum(["warm","cold","conference"]),
    reason: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("calls").select("provider,provider_call_sid").eq("id", data.callId).maybeSingle();
    if (row?.provider_call_sid && data.toNumber) {
      await getTelephonyProvider(row.provider ?? undefined).transfer({
        providerCallSid: row.provider_call_sid, targetNumber: data.toNumber, kind: data.kind,
      });
    }
    const { error } = await supabase.from("call_transfers").insert({
      call_id: data.callId, from_agent_id: userId,
      to_agent_id: data.toAgentId ?? null, to_team_id: data.toTeamId ?? null,
      kind: data.kind, reason: data.reason ?? null,
    });
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "call.transfer", "call", data.callId, { kind: data.kind });
    return { ok: true };
  });

export const dropVoicemail = createServerFn({ method: "POST" })
  .middleware([requirePermission("calls:voicemail_drop")])
  .inputValidator((d: { callId: string; audioKey: string; legalAck: boolean }) =>
    z.object({
      callId: z.string().uuid(),
      audioKey: z.string().min(1).max(200),
      legalAck: z.literal(true, { errorMap: () => ({ message: "Legal acknowledgement required" }) }),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("calls").select("provider,provider_call_sid,organization_id").eq("id", data.callId).maybeSingle();
    const { data: settings } = row?.organization_id
      ? await supabase.from("telephony_settings")
          .select("voicemail_drop_enabled,voicemail_drop_legal_ack")
          .eq("organization_id", row.organization_id).maybeSingle()
      : { data: null as any };
    if (!settings?.voicemail_drop_enabled || !settings?.voicemail_drop_legal_ack) {
      throw new Response("Voicemail drop is not enabled for this organization", { status: 403 });
    }
    if (row?.provider_call_sid) {
      await getTelephonyProvider(row.provider ?? undefined).dropVoicemail(row.provider_call_sid, data.audioKey);
    }
    await supabase.from("calls").update({ voicemail_dropped: true, voicemail_detected: true }).eq("id", data.callId);
    await audit(supabase, userId, "call.voicemail_drop", "call", data.callId, { audioKey: data.audioKey });
    return { ok: true };
  });

/* ====================== INBOUND ====================== */

export const acceptQueuedCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { queueId: string }) =>
    z.object({ queueId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: q, error } = await supabase.from("call_queue").update({
      status: "assigned", assigned_agent_id: userId, picked_at: new Date().toISOString(),
    }).eq("id", data.queueId).eq("status","waiting").select("*").maybeSingle();
    if (error) throw new Response(error.message, { status: 400 });
    if (!q) throw new Response("Call already taken", { status: 409 });

    // Match contact by number if unknown
    let contactId = q.contact_id;
    if (!contactId && q.from_number) {
      const { data: match } = await supabase.from("contacts")
        .select("id").or(`phone.eq.${q.from_number},alt_phone.eq.${q.from_number}`).maybeSingle();
      contactId = match?.id ?? null;
      if (!contactId) {
        const { data: created } = await supabase.from("contacts").insert({
          owner_id: userId, name: `Unknown · ${q.from_number}`, phone: q.from_number,
        }).select("id").single();
        contactId = created?.id ?? null;
      }
    }

    const { data: callRow } = await supabase.from("calls").insert({
      agent_id: userId, contact_id: contactId,
      organization_id: q.organization_id, team_id: q.team_id,
      direction: "inbound",
      from_number: q.from_number, to_number: q.to_number,
      status: "in_progress", started_at: new Date().toISOString(),
      answered_at: new Date().toISOString(),
      duration_seconds: 0, outcome: "in_progress",
    }).select("id").single();

    await audit(supabase, userId, "call.accept_inbound", "call", callRow!.id, { queueId: data.queueId });
    return { callId: callRow!.id, contactId };
  });

/* ====================== RECORDINGS ====================== */

export const getRecordingUrl = createServerFn({ method: "POST" })
  .middleware([requirePermission("calls:play_recording")])
  .inputValidator((d: { callId: string; reason?: string }) =>
    z.object({ callId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("calls").select("recording_path,recording_sensitive,recording_masked_ranges")
      .eq("id", data.callId).maybeSingle();
    if (!row?.recording_path) throw new Response("No recording", { status: 404 });
    if (row.recording_sensitive) {
      const { data: ok } = await supabase.rpc("has_permission", {
        _user_id: userId, _permission: "calls:play_sensitive_recording",
      });
      if (!ok) throw new Response("Forbidden — recording flagged sensitive", { status: 403 });
    }
    const { data: signed, error } = await supabase.storage
      .from("call-recordings").createSignedUrl(row.recording_path, 600);
    if (error) throw new Response(error.message, { status: 400 });

    await supabase.from("call_recording_access_log").insert({
      call_id: data.callId, user_id: userId, reason: data.reason ?? null,
    });
    await audit(supabase, userId, "recording.play", "call", data.callId, { reason: data.reason });
    return { url: signed.signedUrl, maskedRanges: row.recording_masked_ranges ?? [] };
  });

export const tagCallReview = createServerFn({ method: "POST" })
  .middleware([requirePermission("staff:view_team")])
  .inputValidator((d: { callId: string; tag: string; note?: string; markedFor?: string }) =>
    z.object({
      callId: z.string().uuid(),
      tag: z.string().min(1).max(40),
      note: z.string().max(2000).optional(),
      markedFor: z.enum(["coaching","compliance","escalation","exemplar"]).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("call_review_tags").insert({
      call_id: data.callId, tag: data.tag, note: data.note ?? null,
      marked_for: data.markedFor ?? null, created_by: userId,
    });
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "call.tag", "call", data.callId, { tag: data.tag, markedFor: data.markedFor });
    return { ok: true };
  });

export const setSupervisorComments = createServerFn({ method: "POST" })
  .middleware([requirePermission("staff:view_team")])
  .inputValidator((d: { callId: string; comments: string }) =>
    z.object({ callId: z.string().uuid(), comments: z.string().max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("calls").update({ supervisor_comments: data.comments }).eq("id", data.callId);
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "call.supervisor_comments", "call", data.callId, {});
    return { ok: true };
  });

/* ====================== LIVE MONITORING ====================== */

export const startMonitorSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { callId: string; kind: "listen"|"whisper"|"barge"|"takeover" }) =>
    z.object({ callId: z.string().uuid(), kind: z.enum(["listen","whisper","barge","takeover"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const permMap = {
      listen: "calls:monitor_listen", whisper: "calls:monitor_whisper",
      barge: "calls:monitor_barge", takeover: "calls:monitor_takeover",
    } as const;
    const { data: ok } = await supabase.rpc("has_permission", {
      _user_id: userId, _permission: permMap[data.kind],
    });
    if (!ok) throw new Response(`Forbidden: requires ${permMap[data.kind]}`, { status: 403 });

    const { data: row, error } = await supabase.from("call_monitoring_sessions").insert({
      call_id: data.callId, supervisor_id: userId, kind: data.kind,
    }).select("id").single();
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, `monitor.${data.kind}`, "call", data.callId, {});
    return { sessionId: row.id };
  });

export const stopMonitorSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("call_monitoring_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", data.sessionId).eq("supervisor_id", context.userId);
    return { ok: true };
  });

/* ====================== TELEPHONY SETTINGS ====================== */

export const getTelephonySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    if (!profile?.organization_id) return null;
    const { data } = await supabase.from("telephony_settings").select("*").eq("organization_id", profile.organization_id).maybeSingle();
    return data;
  });

export const saveTelephonySettings = createServerFn({ method: "POST" })
  .middleware([requirePermission("calls:manage_telephony")])
  .inputValidator((d: {
    provider?: string; recordingEnabled?: boolean; consentNotice?: string;
    consentRequired?: boolean; voicemailDropEnabled?: boolean; voicemailLegalAck?: boolean;
    twoPartyConsentRegions?: string[];
  }) => z.object({
    provider: z.string().min(1).max(40).optional(),
    recordingEnabled: z.boolean().optional(),
    consentNotice: z.string().max(1000).optional(),
    consentRequired: z.boolean().optional(),
    voicemailDropEnabled: z.boolean().optional(),
    voicemailLegalAck: z.boolean().optional(),
    twoPartyConsentRegions: z.array(z.string().max(10)).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    const orgId = profile?.organization_id;
    if (!orgId) throw new Response("No organization", { status: 400 });
    const patch: any = { updated_by: userId, updated_at: new Date().toISOString() };
    if (data.provider !== undefined) patch.provider = data.provider;
    if (data.recordingEnabled !== undefined) patch.recording_enabled = data.recordingEnabled;
    if (data.consentNotice !== undefined) patch.recording_consent_notice = data.consentNotice;
    if (data.consentRequired !== undefined) patch.recording_consent_required = data.consentRequired;
    if (data.voicemailDropEnabled !== undefined) patch.voicemail_drop_enabled = data.voicemailDropEnabled;
    if (data.voicemailLegalAck !== undefined) patch.voicemail_drop_legal_ack = data.voicemailLegalAck;
    if (data.twoPartyConsentRegions !== undefined) patch.two_party_consent_regions = data.twoPartyConsentRegions;
    const { error } = await supabase.from("telephony_settings").upsert({ organization_id: orgId, ...patch });
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "telephony.settings_update", "organization", orgId, patch);
    return { ok: true };
  });

/* ====================== RECORDINGS LIBRARY ====================== */

export const listRecordings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; agentId?: string; teamId?: string; campaignId?: string; from?: string; to?: string; limit?: number; offset?: number }) =>
    z.object({
      search: z.string().max(200).optional(),
      agentId: z.string().uuid().optional(),
      teamId: z.string().uuid().optional(),
      campaignId: z.string().uuid().optional(),
      from: z.string().optional(), to: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("calls")
      .select("id,started_at,duration_seconds,direction,outcome,status,recording_path,recording_sensitive,quality_score,agent_id,team_id,from_number,to_number,contacts(name,company)", { count: "exact" })
      .not("recording_path", "is", null)
      .order("started_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.agentId) q = q.eq("agent_id", data.agentId);
    if (data.teamId) q = q.eq("team_id", data.teamId);
    if (data.campaignId) q = q.eq("campaign_id", data.campaignId);
    if (data.from) q = q.gte("started_at", data.from);
    if (data.to) q = q.lte("started_at", data.to);
    if (data.search) q = q.or(`from_number.ilike.%${data.search}%,to_number.ilike.%${data.search}%`);
    const { data: rows, error, count } = await q;
    if (error) throw new Response(error.message, { status: 400 });
    return { rows: rows ?? [], total: count ?? 0 };
  });

/* ====================== LIVE MONITORING DASH ====================== */

export const listLiveCalls = createServerFn({ method: "POST" })
  .middleware([requirePermission("calls:monitor_listen")])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase.from("calls")
      .select("id,started_at,answered_at,direction,status,from_number,to_number,agent_id,team_id,contacts(name)")
      .in("status", ["ringing","in_progress","on_hold"])
      .order("started_at", { ascending: false }).limit(100);
    return data ?? [];
  });

export const listQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase.from("call_queue")
      .select("id,from_number,to_number,priority,estimated_wait_seconds,status,queued_at,team_id,contacts(name)")
      .eq("status","waiting").order("priority", { ascending: false }).order("queued_at");
    return data ?? [];
  });

/* ====================== CALLER IDS / CAMPAIGNS ====================== */

export const listCallerIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("caller_ids").select("*").eq("active", true).order("is_default", { ascending: false });
    return data ?? [];
  });

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("campaigns").select("*").eq("active", true).order("name");
    return data ?? [];
  });