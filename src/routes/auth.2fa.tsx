import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CCButton, CCCard, CCField, CCInput } from "@/components/cc";
import { Headset, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * Two-factor challenge screen — wired to Supabase Auth MFA (TOTP).
 * Reads the user's verified factor, issues a challenge, and verifies the
 * 6-digit code. Requires Supabase Auth MFA to be enabled on the project.
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
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setLoadError(error.message); return; }
      const totp = data?.totp?.find((f) => f.status === "verified") ?? data?.totp?.[0];
      if (!totp) { setLoadError("No authenticator enrolled. Visit Security settings to set one up."); return; }
      setFactorId(totp.id);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return toast.error("Enter the 6-digit code from your authenticator app.");
    if (!factorId) return toast.error(loadError ?? "No authenticator available.");
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) return toast.error(error.message);
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
        {loadError && (
          <p className="mt-4 text-xs text-[color:var(--cc-danger)] text-center">{loadError}</p>
        )}
        <p className="mt-6 text-xs text-[color:var(--cc-ink-500)] text-center">
          Lost your device? Contact your Operations Administrator to reset 2FA.
        </p>
      </CCCard>
    </div>
  );
}