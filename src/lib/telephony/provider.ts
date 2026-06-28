/**
 * Back-compat re-export shim. The abstraction now lives in
 * `src/lib/telephony/*` split across focused files (types, stub, twilio,
 * vonage, registry, events). Existing imports of
 * `@/lib/telephony/provider` keep working — new code should import from
 * `@/lib/telephony` instead.
 */
export * from "./index";
