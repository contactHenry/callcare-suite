import { describe, it, expect, vi } from "vitest";
import { applyTelephonyEvent } from "../events";
import type { TelephonyEvent } from "../types";

/** Build a minimal fake supabase that captures the patch sent to `.update()`. */
function makeFakeClient(existing: any | null) {
  const updates: Array<{ table: string; patch: Record<string, unknown>; id: string }> = [];
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: existing }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            updates.push({ table, patch, id });
            return { error: null };
          },
        }),
      };
    },
  };
  return { client, updates };
}

describe("applyTelephonyEvent", () => {
  it("returns matched=false when no call row matches the provider SID", async () => {
    const { client } = makeFakeClient(null);
    const event: TelephonyEvent = {
      providerCallSid: "ghost",
      kind: "answered",
      occurredAt: new Date().toISOString(),
    };
    const r = await applyTelephonyEvent(client as any, event);
    expect(r.matched).toBe(false);
  });

  it("maps 'answered' to in_progress and stamps answered_at", async () => {
    const { client, updates } = makeFakeClient({ id: "c1", status: "ringing" });
    const at = "2024-01-01T00:00:00.000Z";
    await applyTelephonyEvent(client as any, { providerCallSid: "x", kind: "answered", occurredAt: at });
    expect(updates[0].patch.status).toBe("in_progress");
    expect(updates[0].patch.answered_at).toBe(at);
  });

  it("recording_ready writes recording_path and duration", async () => {
    const { client, updates } = makeFakeClient({ id: "c2", status: "in_progress" });
    await applyTelephonyEvent(client as any, {
      providerCallSid: "x", kind: "recording_ready", occurredAt: "2024-01-01T00:00:00Z",
      durationSeconds: 42, recordingPath: "rec_abc",
    });
    expect(updates[0].patch.recording_path).toBe("rec_abc");
    expect(updates[0].patch.duration_seconds).toBe(42);
    expect(updates[0].patch.status).toBe("completed");
  });

  it("ignores non-positive duration values on completion", async () => {
    const { client, updates } = makeFakeClient({ id: "c3", status: "in_progress" });
    await applyTelephonyEvent(client as any, {
      providerCallSid: "x", kind: "completed", occurredAt: "2024-01-01T00:00:00Z", durationSeconds: 0,
    });
    expect("duration_seconds" in updates[0].patch).toBe(false);
  });
});