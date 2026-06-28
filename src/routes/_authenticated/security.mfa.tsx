import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCCard, CCField, CCInput } from "@/components/cc";
import { ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { toast } from "sonner";

/**
 * Opt-in TOTP enrollment & management.
 * Requires Supabase Auth MFA enabled on the project; if disabled,
 * `listFactors()` and `enroll()` surface a clear error to the user.
 */
export const Route = createFileRoute("/_authenticated/security/mfa")({
  head: () => ({ meta: [{ title: "Two-factor authentication — Security" }] }),
  component: MfaPage,
});

type Factor = { id: string; friendly_name: string | null; status: "verified" | "unverified"; factor_type: string };

function MfaPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) return toast.error(error.message);
    setFactors((data?.totp ?? []) as Factor[]);
  };

  useEffect(() => { refresh(); }, []);

  async function beginEnroll() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator (${new Date().toLocaleDateString()})` });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data) return;
    setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment) return;
    if (!/^\d{6}$/.test(code)) return toast.error("Enter the 6-digit code from your authenticator app.");
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Two-factor authentication enabled");
    setEnrollment(null);
    setCode("");
    refresh();
  }

  async function cancelEnroll() {
    if (!enrollment) return;
    await supabase.auth.mfa.unenroll({ factorId: enrollment.id });
    setEnrollment(null);
  }

  async function removeFactor(id: string) {
    if (!confirm("Remove this authenticator? You won't be prompted for a code on next sign-in.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) return toast.error(error.message);
    toast.success("Authenticator removed");
    refresh();
  }

  return (
    <>
      <PageHeader
        title="Two-factor authentication"
        description="Protect your account with a time-based one-time password from an authenticator app (Google Authenticator, 1Password, Authy)."
      />
      <div className="p-8 space-y-6 max-w-3xl">
        <CCCard className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-[color:var(--cc-brand-600)]/10 text-[color:var(--cc-brand-600)] flex items-center justify-center">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <div className="font-semibold">Authenticator apps</div>
                <div className="text-sm text-muted-foreground">
                  {loading ? "Loading…" : factors.length === 0 ? "No authenticator enrolled." : `${factors.length} authenticator${factors.length === 1 ? "" : "s"} on file.`}
                </div>
              </div>
            </div>
            {!enrollment && (
              <CCButton onClick={beginEnroll} disabled={busy}>Add authenticator</CCButton>
            )}
          </div>

          {factors.length > 0 && (
            <ul className="mt-6 divide-y border-t">
              {factors.map((f) => (
                <li key={f.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Smartphone className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{f.friendly_name || "Authenticator"}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.status === "verified" ? "Active" : "Pending verification"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFactor(f.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--cc-danger)] hover:underline"
                  >
                    <ShieldOff className="size-3.5" /> Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CCCard>

        {enrollment && (
          <CCCard className="p-6">
            <div className="font-semibold mb-1">Scan this QR code</div>
            <p className="text-sm text-muted-foreground mb-4">
              Open your authenticator app and scan the code, then enter the 6-digit code it generates.
            </p>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="shrink-0 self-center">
                {/* enrollment.qr is a data: URL or SVG */}
                {enrollment.qr.startsWith("<") ? (
                  <div className="size-44 bg-white p-2 border rounded-md" dangerouslySetInnerHTML={{ __html: enrollment.qr }} />
                ) : (
                  <img src={enrollment.qr} width={176} height={176} alt="TOTP QR code" className="size-44 bg-white p-2 border rounded-md" />
                )}
              </div>
              <form onSubmit={confirmEnroll} className="flex-1 space-y-4">
                <CCField label="Manual setup key" hint="Paste this into your app if you can't scan.">
                  <CCInput readOnly value={enrollment.secret} className="font-mono text-xs" />
                </CCField>
                <CCField label="Verification code">
                  <CCInput
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-xl tracking-[0.4em] font-semibold"
                  />
                </CCField>
                <div className="flex gap-2">
                  <CCButton type="submit" disabled={busy}>{busy ? "Verifying…" : "Confirm & enable"}</CCButton>
                  <CCButton type="button" variant="ghost" onClick={cancelEnroll} disabled={busy}>Cancel</CCButton>
                </div>
              </form>
            </div>
          </CCCard>
        )}
      </div>
    </>
  );
}