import { createFileRoute } from "@tanstack/react-router";
import { getTelephonyProvider, applyTelephonyEvent } from "@/lib/telephony";

/**
 * Provider-agnostic telephony webhook ingress.
 *
 * URL: POST /api/public/webhooks/telephony/{provider}
 * - Signature verification is delegated to the provider implementation.
 * - Verified payloads are normalized to `TelephonyEvent` and applied via
 *   `applyTelephonyEvent`. Unknown / heartbeat payloads return 200 OK.
 * - Body is read raw first so providers requiring HMAC-of-body can verify.
 */
export const Route = createFileRoute("/api/public/webhooks/telephony/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const providerName = String(params.provider ?? "").toLowerCase();
        const provider = getTelephonyProvider(providerName);

        const rawBody = await request.text();
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

        const verified = await provider.verifyWebhook(rawBody, headers);
        if (!verified) return new Response("Invalid signature", { status: 401 });

        let payload: unknown = null;
        const ct = headers["content-type"] ?? "";
        try {
          if (ct.includes("application/json")) payload = JSON.parse(rawBody);
          else if (ct.includes("application/x-www-form-urlencoded")) {
            const params = new URLSearchParams(rawBody);
            payload = Object.fromEntries(params.entries());
          } else {
            payload = rawBody;
          }
        } catch { return new Response("Malformed body", { status: 400 }); }

        const event = provider.parseWebhook(payload);
        if (!event) return new Response("ok"); // known but irrelevant

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const result = await applyTelephonyEvent(supabaseAdmin as any, event);
        return Response.json({ ok: true, matched: result.matched, kind: event.kind });
      },
    },
  },
});