import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CCButton, CCInput, CCField } from "@/components/cc";
import { toast } from "sonner";
import { Headset, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth/forgot")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reset password — Call Centre" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Reset link sent — check your email.");
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
        <h1 className="text-3xl font-bold tracking-tight">Forgot password?</h1>
        <p className="text-sm text-[color:var(--cc-ink-500)] mt-2">
          Enter the email tied to your staff account and we'll send a secure reset link.
        </p>
        {sent
          ? (
            <div className="mt-6 rounded-[var(--cc-radius-md)] border border-[color:var(--cc-success)] bg-[color:var(--cc-success-soft)] p-4 text-sm">
              Check <strong>{email}</strong> for a reset link. The link expires in 1 hour.
            </div>
          )
          : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <CCField label="Work email">
                <CCInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </CCField>
              <CCButton type="submit" size="lg" variant="primary" className="w-full !bg-[#5b21b6] hover:!bg-[#4c1d95] !text-white" disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </CCButton>
            </form>
          )}
        <button
          type="button"
          onClick={() => navigate({ to: "/auth" })}
          className="mt-6 text-sm text-[color:var(--cc-ink-700)] hover:text-[color:var(--cc-ink-900)] inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" /> Back to sign in
        </button>
      </div>
    </div>
  );
}