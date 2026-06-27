import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CCButton, CCInput, CCField } from "@/components/cc";
import { toast } from "sonner";
import { Headset } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Set new password — Call Centre" }] }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  // Supabase places `type=recovery` in the URL hash. Wait for the session to
  // hydrate from it before showing the form.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isRecovery = window.location.hash.includes("type=recovery");
    if (!isRecovery) {
      toast.error("This reset link is invalid or expired.");
      navigate({ to: "/auth/forgot" });
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // If the SDK already hydrated synchronously, surface the form.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters.");
    if (pw !== pw2) return toast.error("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated — signing you in.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[color:var(--cc-ink-50)]">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="size-9 rounded-md bg-[color:var(--cc-brand-600)] text-white flex items-center justify-center">
            <Headset className="size-5" />
          </div>
          <span className="font-semibold text-lg">Call Centre</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Set a new password</h1>
        <p className="text-sm text-[color:var(--cc-ink-500)] mt-2">
          Pick something with at least 8 characters and a mix of letters and numbers.
        </p>
        {ready
          ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <CCField label="New password">
                <CCInput type="password" required value={pw} onChange={(e) => setPw(e.target.value)} />
              </CCField>
              <CCField label="Confirm password">
                <CCInput type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </CCField>
              <CCButton type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </CCButton>
            </form>
          )
          : (
            <div className="mt-6 text-sm text-[color:var(--cc-ink-500)]">Verifying reset link…</div>
          )}
      </div>
    </div>
  );
}