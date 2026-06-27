/**
 * Telephony provider abstraction.
 *
 * Business logic ONLY talks to this interface — never to Twilio, Sinch,
 * Vonage, or any vendor SDK directly. Swap providers by implementing
 * `TelephonyProvider` and registering it in `getTelephonyProvider()`.
 *
 * The shipped default is a stub that mints fake call SIDs so the UI and
 * server flows work end-to-end before real provider credentials exist.
 */

export type DialMode = "manual" | "preview" | "progressive" | "power" | "predictive";

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

export interface TelephonyProvider {
  readonly name: string;
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;
  hangup(providerCallSid: string): Promise<void>;
  mute(providerCallSid: string, muted: boolean): Promise<void>;
  hold(providerCallSid: string, onHold: boolean): Promise<void>;
  transfer(input: TransferInput): Promise<void>;
  startMonitoring(input: MonitorInput): Promise<{ sessionSid: string }>;
  stopMonitoring(sessionSid: string): Promise<void>;
  dropVoicemail(providerCallSid: string, audioKey: string): Promise<void>;
  finalizeRecording(providerCallSid: string): Promise<RecordingHandle | null>;
}

/* ---------------- Stub provider (default) ---------------- */

class StubProvider implements TelephonyProvider {
  readonly name = "stub";
  async placeCall(i: PlaceCallInput): Promise<PlaceCallResult> {
    return {
      providerCallSid: `stub_${i.callId.slice(0, 8)}_${Date.now()}`,
      status: "ringing",
      estimatedConnectMs: 1500,
    };
  }
  async hangup() {}
  async mute() {}
  async hold() {}
  async transfer() {}
  async startMonitoring(i: MonitorInput) {
    return { sessionSid: `mon_${i.kind}_${Date.now()}` };
  }
  async stopMonitoring() {}
  async dropVoicemail() {}
  async finalizeRecording() { return null; }
}

/* ---------------- Registry ---------------- */

const providers: Record<string, () => TelephonyProvider> = {
  stub: () => new StubProvider(),
  // twilio: () => new TwilioProvider(),  // wire up when credentials available
};

export function getTelephonyProvider(name?: string): TelephonyProvider {
  const key = (name ?? process.env.TELEPHONY_PROVIDER ?? "stub").toLowerCase();
  const factory = providers[key] ?? providers.stub;
  return factory();
}