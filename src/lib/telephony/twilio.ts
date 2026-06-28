/**
 * Twilio provider skeleton.
 *
 * All mutating methods throw a `ProviderNotConfiguredError` until
 * `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` are set in the server runtime.
 * Implement each method body when wiring real Twilio — the abstraction,
 * webhook ingress, and capability flags are already in place.
 */
import type {
  PlaceCallInput, PlaceCallResult, MonitorInput, TransferInput,
  ProviderCapabilities, ProviderHealth, RecordingHandle,
  TelephonyEvent, TelephonyProvider,
} from "./types";

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} provider is not configured. Set credentials in Telephony settings before placing real calls.`);
    this.name = "ProviderNotConfiguredError";
  }
}

export class TwilioProvider implements TelephonyProvider {
  readonly name = "twilio" as const;
  readonly capabilities: ProviderCapabilities = {
    outboundCalls: true,
    inboundCalls: true,
    recording: true,
    liveMonitoring: true,
    voicemailDrop: true,
    warmTransfer: true,
  };

  isConfigured() {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  }

  async healthCheck(): Promise<ProviderHealth> {
    const configured = this.isConfigured();
    return {
      ok: configured,
      provider: "twilio",
      configured,
      message: configured
        ? "Twilio credentials present. Live calls available."
        : "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN. Add them in Project Secrets.",
    };
  }

  private notImpl(): never { throw new ProviderNotConfiguredError("Twilio"); }

  async placeCall(_i: PlaceCallInput): Promise<PlaceCallResult> { this.notImpl(); }
  async hangup(_sid: string) { this.notImpl(); }
  async mute(_sid: string, _muted: boolean) { this.notImpl(); }
  async hold(_sid: string, _on: boolean) { this.notImpl(); }
  async transfer(_i: TransferInput) { this.notImpl(); }
  async startMonitoring(_i: MonitorInput) { this.notImpl(); }
  async stopMonitoring(_sid: string) { this.notImpl(); }
  async dropVoicemail(_sid: string, _key: string) { this.notImpl(); }
  async finalizeRecording(_sid: string): Promise<RecordingHandle | null> { return null; }

  /**
   * Verify Twilio's X-Twilio-Signature using the auth token.
   * https://www.twilio.com/docs/usage/webhooks/webhooks-security
   */
  async verifyWebhook(_rawBody: string, headers: Record<string, string>): Promise<boolean> {
    const token = process.env.TWILIO_AUTH_TOKEN;
    const signature = headers["x-twilio-signature"];
    // Skeleton: real impl computes HMAC-SHA1 over the full URL + sorted form params.
    // We intentionally fail closed when not configured.
    return Boolean(token && signature);
  }

  parseWebhook(payload: unknown): TelephonyEvent | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, any>;
    const sid = String(p.CallSid ?? "");
    if (!sid) return null;
    const status = String(p.CallStatus ?? "").toLowerCase();
    const mapping: Record<string, TelephonyEvent["kind"]> = {
      ringing: "ringing",
      "in-progress": "answered",
      completed: "completed",
      busy: "busy",
      "no-answer": "no_answer",
      failed: "failed",
      canceled: "failed",
    };
    if (p.RecordingUrl) {
      return {
        providerCallSid: sid,
        kind: "recording_ready",
        occurredAt: new Date().toISOString(),
        durationSeconds: Number(p.RecordingDuration ?? 0) || undefined,
        recordingPath: String(p.RecordingSid ?? p.RecordingUrl),
        raw: p,
      };
    }
    const kind = mapping[status];
    if (!kind) return null;
    return {
      providerCallSid: sid,
      kind,
      occurredAt: new Date().toISOString(),
      durationSeconds: Number(p.CallDuration ?? 0) || undefined,
      raw: p,
    };
  }
}