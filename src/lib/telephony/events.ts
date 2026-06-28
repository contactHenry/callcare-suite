/**
 * Apply a normalized `TelephonyEvent` to the `calls` table.
 *
 * This is the ONLY place that knows the mapping from telephony event ->
 * call row state. Webhook ingress + provider polling both funnel here,
 * so provider-agnostic behaviour stays in one place.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TelephonyEvent } from "./types";

const STATUS_MAP: Record<TelephonyEvent["kind"], string> = {
  ringing: "ringing",
  answered: "in_progress",
  completed: "completed",
  failed: "failed",
  no_answer: "no_answer",
  busy: "busy",
  voicemail: "voicemail",
  recording_ready: "completed",
};

export async function applyTelephonyEvent(
  supabase: SupabaseClient,
  event: TelephonyEvent,
): Promise<{ matched: boolean; callId?: string }> {
  const { data: row } = await supabase
    .from("calls")
    .select("id, status, duration_seconds, recording_path")
    .eq("provider_call_sid", event.providerCallSid)
    .maybeSingle();
  if (!row) return { matched: false };

  const patch: Record<string, unknown> = { status: STATUS_MAP[event.kind] };
  if (event.kind === "answered") patch.answered_at = event.occurredAt;
  if (event.kind === "completed" || event.kind === "recording_ready") {
    patch.ended_at = event.occurredAt;
    if (typeof event.durationSeconds === "number" && event.durationSeconds > 0) {
      patch.duration_seconds = event.durationSeconds;
    }
  }
  if (event.kind === "recording_ready" && event.recordingPath) {
    patch.recording_path = event.recordingPath;
  }

  await supabase.from("calls").update(patch).eq("id", row.id);
  return { matched: true, callId: row.id };
}