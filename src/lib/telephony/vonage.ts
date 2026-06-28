/**
 * Vonage provider skeleton. Same shape as Twilio — fill in when wiring.
 */
import type {
  PlaceCallInput, PlaceCallResult, MonitorInput, TransferInput,
  ProviderCapabilities, ProviderHealth, RecordingHandle,
  TelephonyEvent, TelephonyProvider,
} from "./types";
import { ProviderNotConfiguredError } from "./twilio";

export class VonageProvider implements TelephonyProvider {
  readonly name = "vonage" as const;
  readonly capabilities: ProviderCapabilities = {
    outboundCalls: true,
    inboundCalls: true,
    recording: true,
    liveMonitoring: false,
    voicemailDrop: false,
    warmTransfer: true,
  };

  isConfigured() {
    return Boolean(process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET);
  }

  async healthCheck(): Promise<ProviderHealth> {
    const configured = this.isConfigured();
    return {
      ok: configured,
      provider: "vonage",
      configured,
      message: configured
        ? "Vonage credentials present."
        : "Missing VONAGE_API_KEY or VONAGE_API_SECRET.",
    };
  }

  private notImpl(): never { throw new ProviderNotConfiguredError("Vonage"); }

  async placeCall(_i: PlaceCallInput): Promise<PlaceCallResult> { this.notImpl(); }
  async hangup(_sid: string) { this.notImpl(); }
  async mute(_sid: string, _muted: boolean) { this.notImpl(); }
  async hold(_sid: string, _on: boolean) { this.notImpl(); }
  async transfer(_i: TransferInput) { this.notImpl(); }
  async startMonitoring(_i: MonitorInput): Promise<{ sessionSid: string }> { this.notImpl(); }
  async stopMonitoring(_sid: string) { this.notImpl(); }
  async dropVoicemail(_sid: string, _key: string) { this.notImpl(); }
  async finalizeRecording(_sid: string): Promise<RecordingHandle | null> { return null; }

  async verifyWebhook(_rawBody: string, _headers: Record<string, string>) { return false; }
  parseWebhook(_payload: unknown): TelephonyEvent | null { return null; }
}