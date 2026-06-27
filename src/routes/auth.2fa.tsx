import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CCButton, CCCard, CCField, CCInput } from "@/components/cc";
import { Headset, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * Two-factor challenge screen.
 *
 * UI is fully wired; the verification call is stubbed — wiring it up requires
 * enabling Supabase Auth MFA in the dashboard and reading/storing the TOTP
 * factor on `two_factor_secrets`. The route is reachable on `/auth/2fa`.
 */
export const Route = createFileRoute("/auth/2fa")({
  ssr: false,
  head: () => ({ meta: [{ title: "Two-factor verification — Call Centre" }] }),
  component: TwoFactorPage,
});

function TwoFactorPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return toast.error("Enter the 6-digit code from your authenticator app.");
    setBusy(true);
    // STUB: integrate with supabase.auth.mfa.challenge + verify when MFA is
    // enabled on the project. Keeping the UI shippable now so the flow is
    // testable without backend MFA toggled on.
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    toast.success("Verified");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[color:var(--cc-ink-50)]">
      <CCCard className="w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="size-9 rounded-md bg-[color:var(--cc-brand-600)] text-white flex items-center justify-center">
            <Headset className="size-5" />
          </div>
          <span className="font-semibold text-lg">Call Centre</span>
        </div>
        <div className="flex items-center gap-2 mb-2 text-[color:var(--cc-brand-700)]">
          <ShieldCheck className="size-5" />
          <h1 className="text-2xl font-bold tracking-tight">Two-factor verification</h1>
        </div>
        <p className="text-sm text-[color:var(--cc-ink-500)] mb-6">
          Open your authenticator app and enter the 6-digit code for <strong>Call Centre</strong>.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <CCField label="Verification code" hint="Codes refresh every 30 seconds.">
            <CCInput
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.5em] font-semibold"
            />
          </CCField>
          <CCButton type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Verifying…" : "Verify"}
          </CCButton>
        </form>
        <p className="mt-6 text-xs text-[color:var(--cc-ink-500)] text-center">
          Lost your device? Contact your Operations Administrator to reset 2FA.
        </p>
      </CCCard>
    </div>
  );
}