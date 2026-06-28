/**
 * Telephony provider registry.
 *
 * `getTelephonyProvider(name)` is the single entry point used by
 * `calls.functions.ts` and the webhook ingress. Instances are memoized
 * per provider name so SDK clients are reused across server-fn calls
 * within the same worker isolate.
 */
import type { ProviderName, TelephonyProvider } from "./types";
import { StubProvider } from "./stub";
import { TwilioProvider } from "./twilio";
import { VonageProvider } from "./vonage";

const factories: Record<ProviderName, () => TelephonyProvider> = {
  stub: () => new StubProvider(),
  twilio: () => new TwilioProvider(),
  vonage: () => new VonageProvider(),
  // Sinch falls back to stub until a skeleton is added.
  sinch: () => new StubProvider(),
};

const cache: Partial<Record<ProviderName, TelephonyProvider>> = {};

export function getTelephonyProvider(name?: string | null): TelephonyProvider {
  const requested = (name ?? process.env.TELEPHONY_PROVIDER ?? "stub").toLowerCase() as ProviderName;
  const key: ProviderName = (factories[requested] ? requested : "stub");
  return (cache[key] ??= factories[key]());
}

export function listKnownProviders(): ProviderName[] {
  return Object.keys(factories) as ProviderName[];
}