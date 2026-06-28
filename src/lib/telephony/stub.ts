/**
 * Default telephony provider. Mints fake call SIDs so the entire
 * outbound/inbound/recording flow works end-to-end without vendor creds.
 */
import type {
  PlaceCallInput, PlaceCallResult, MonitorInput,
  ProviderCapabilities, ProviderHealth, TelephonyEvent, TelephonyProvider,
} from "./types";

export class StubProvider implements TelephonyProvider {
  readonly name = "stub" as const;
  readonly capabilities: ProviderCapabilities = {
    outboundCalls: true,
    inboundCalls: false,
    recording: false,
    liveMonitoring: false,
    voicemailDrop: false,
    warmTransfer: false,
  };

  isConfigured() { return true; }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: true,
      provider: "stub",
      configured: true,
      message: "Stub provider — no real calls will be placed.",
    };
  }

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
  async startMonitoring(i: MonitorInput) { return { sessionSid: `mon_${i.kind}_${Date.now()}` }; }
  async stopMonitoring() {}
  async dropVoicemail() {}
  async finalizeRecording() { return null; }

  async verifyWebhook() { return true; }
  parseWebhook(_payload: unknown): TelephonyEvent | null { return null; }
}