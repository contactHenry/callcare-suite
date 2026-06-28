/**
 * Telephony abstraction — shared types.
 *
 * Business logic ONLY talks to `TelephonyProvider` and `TelephonyEvent`.
 * Vendor-specific code (Twilio, Vonage, Sinch) lives in sibling files and
 * is never imported anywhere outside `src/lib/telephony/*`.
 */

export type DialMode = "manual" | "preview" | "progressive" | "power" | "predictive";

export type ProviderName = "stub" | "twilio" | "vonage" | "sinch";

export interface PlaceCallInput {
  fromNumber: string;
  toNumber: string;
  callId: string;            // our internal call row id
  agentId: string;
  recordingEnabled: boolean;
  voicemailDetection?: boolean;
}

export interface PlaceCallResult {
  providerCallSid: string;
  status: "queued" | "ringing" | "in_progress" | "failed";
  estimatedConnectMs?: number;
}

export interface TransferInput {
  providerCallSid: string;
  targetNumber: string;
  kind: "warm" | "cold" | "conference";
}

export interface MonitorInput {
  providerCallSid: string;
  supervisorId: string;
  kind: "listen" | "whisper" | "barge" | "takeover";
}

export interface RecordingHandle {
  storagePath: string;        // path inside the `call-recordings` bucket
  durationSeconds: number;
}

/**
 * Provider capability matrix.
 *
 * The UI uses this to disable unsupported actions — e.g. the stub provider
 * does not support live monitoring, so the "Listen" button greys out
 * automatically when the org is set to stub.
 */
export interface ProviderCapabilities {
  outboundCalls: boolean;
  inboundCalls: boolean;
  recording: boolean;
  liveMonitoring: boolean;
  voicemailDrop: boolean;
  warmTransfer: boolean;
}

/**
 * Result of a non-destructive credential check. Surfaced in
 * Telephony settings so admins know whether the provider is wired up
 * before they place real calls.
 */
export interface ProviderHealth {
  ok: boolean;
  provider: ProviderName;
  configured: boolean;
  message: string;
}

export interface TelephonyProvider {
  readonly name: ProviderName;
  readonly capabilities: ProviderCapabilities;
  /** True when the vendor SDK has all secrets/config it needs. */
  isConfigured(): boolean;
  /** Non-destructive credential check — no real call placed. */
  healthCheck(): Promise<ProviderHealth>;

  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;
  hangup(providerCallSid: string): Promise<void>;
  mute(providerCallSid: string, muted: boolean): Promise<void>;
  hold(providerCallSid: string, onHold: boolean): Promise<void>;
  transfer(input: TransferInput): Promise<void>;
  startMonitoring(input: MonitorInput): Promise<{ sessionSid: string }>;
  stopMonitoring(sessionSid: string): Promise<void>;
  dropVoicemail(providerCallSid: string, audioKey: string): Promise<void>;
  finalizeRecording(providerCallSid: string): Promise<RecordingHandle | null>;

  /**
   * Verify the signature of an inbound webhook from this provider, given
   * the raw request body and headers. Default implementations accept any
   * request when no signing secret is configured (stub providers).
   */
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<boolean>;

  /**
   * Translate a verified provider-specific webhook payload into a
   * normalized `TelephonyEvent`. Returning `null` means the payload is
   * known but irrelevant (e.g. heartbeat) and should be silently dropped.
   */
  parseWebhook(payload: unknown): TelephonyEvent | null;
}

/* ===================== Normalized event ===================== */

export type TelephonyEventKind =
  | "ringing"
  | "answered"
  | "completed"
  | "failed"
  | "no_answer"
  | "busy"
  | "voicemail"
  | "recording_ready";

export interface TelephonyEvent {
  providerCallSid: string;
  kind: TelephonyEventKind;
  occurredAt: string;          // ISO8601
  durationSeconds?: number;
  /** Storage path for recording_ready events. */
  recordingPath?: string;
  /** Provider-specific extras kept for the audit log only. */
  raw?: Record<string, unknown>;
}