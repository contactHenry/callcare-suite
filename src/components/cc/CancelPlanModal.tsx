import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/contexts/PlanContext";
import { cancelPlan, reactivatePlan } from "@/lib/billing/subscription.functions";
import type { PlanFeatures, FeatureKey } from "@/lib/billing/gates";

const VALUE_FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "live_monitoring", label: "Live call monitoring for your team" },
  { key: "call_recording", label: "Call recording and review" },
  { key: "whisper_barge_takeover", label: "Whisper, barge & takeover" },
  { key: "compliance_centre", label: "Compliance centre and audit logs" },
  { key: "advanced_reporting", label: "Advanced reporting" },
  { key: "qa_scorecards", label: "QA scorecards & coaching" },
  { key: "campaign_management", label: "Campaign management" },
  { key: "sso", label: "Single sign-on (SSO)" },
  { key: "api_access", label: "API access" },
];

const REASONS = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "missing_features", label: "Missing features I need" },
  { value: "switching", label: "Switching to another product" },
  { value: "business_change", label: "Business needs have changed" },
  { value: "not_using", label: "Not using it enough" },
  { value: "other", label: "Other" },
];

function formatLongDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export interface CancelPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelPlanModal({ open, onOpenChange }: CancelPlanModalProps) {
  const { plan, subscription, currentPeriodEnd, refetch } = usePlan();
  const features = (plan.features ?? {}) as PlanFeatures;
  const included = useMemo(
    () => VALUE_FEATURES.filter((f) => features[f.key] === true).slice(0, 6),
    [features],
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState<string>("");
  const [otherText, setOtherText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accessUntil, setAccessUntil] = useState<string | null>(currentPeriodEnd);

  const usageQ = useQuery({
    enabled: open && step === 1,
    queryKey: ["cancel-usage-snapshot", subscription.org_id],
    queryFn: async () => {
      const [users, recordings, campaigns] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true })
          .eq("organization_id", subscription.org_id),
        supabase.from("calls").select("id", { count: "exact", head: true })
          .not("recording_url", "is", null),
        supabase.from("campaigns").select("id", { count: "exact", head: true }),
      ]);
      return {
        users: users.count ?? 0,
        recordings: recordings.count ?? 0,
        campaigns: campaigns.count ?? 0,
      };
    },
  });

  const cancelFn = useServerFn(cancelPlan);
  const reactivateFn = useServerFn(reactivatePlan);

  const cancelMutation = useMutation({
    mutationFn: () => {
      const reasonLabel = REASONS.find((r) => r.value === reason)?.label ?? reason;
      return cancelFn({
        data: {
          reason: reason === "other" && otherText ? `other: ${otherText}` : reasonLabel || undefined,
          feedback: feedback || undefined,
        },
      });
    },
    onSuccess: (res) => {
      setAccessUntil(res.accessUntil ?? currentPeriodEnd);
      refetch();
      setStep(3);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateFn({}),
    onSuccess: () => {
      refetch();
      onOpenChange(false);
      toast.success(`Welcome back — your ${plan.name} plan will continue without interruption.`);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    },
  });

  const busy = cancelMutation.isPending || reactivateMutation.isPending;

  function handleClose(v: boolean) {
    if (busy) return;
    if (!v) {
      // Reset for next open
      setStep(1);
      setReason("");
      setOtherText("");
      setFeedback("");
      setError(null);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px]">
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Before you go — here's what you'd lose access to</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <ul className="space-y-1.5 text-sm">
                {included.length === 0 ? (
                  <li className="text-muted-foreground">Your current plan's features.</li>
                ) : included.map((f) => (
                  <li key={f.key} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 text-emerald-600 shrink-0" strokeWidth={2.25} />
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                You have{" "}
                <span className="font-medium text-foreground">{usageQ.data?.users ?? "…"}</span> active users,{" "}
                <span className="font-medium text-foreground">{usageQ.data?.recordings ?? "…"}</span> call recordings, and{" "}
                <span className="font-medium text-foreground">{usageQ.data?.campaigns ?? "…"}</span> campaigns.
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" onClick={() => handleClose(false)}>Keep my plan</Button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Continue with cancellation
              </button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Help us understand</DialogTitle>
              <p className="text-sm text-muted-foreground">Optional — takes 10 seconds</p>
            </DialogHeader>
            <div className="space-y-4">
              <RadioGroup value={reason} onValueChange={setReason} className="space-y-1.5">
                {REASONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                    <span>{r.label}</span>
                  </label>
                ))}
              </RadioGroup>
              {reason === "other" && (
                <Input
                  placeholder="Tell us more"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                />
              )}
              <div className="space-y-1.5">
                <Label htmlFor="cancel-feedback">Anything else you'd like to share?</Label>
                <Textarea
                  id="cancel-feedback"
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </div>
              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={busy}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
              >
                Back
              </button>
              <Button
                variant="outline"
                onClick={() => { setError(null); cancelMutation.mutate(); }}
                disabled={busy}
              >
                {cancelMutation.isPending ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" /> Cancelling…</>
                ) : "Confirm cancellation"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="size-5 text-[color:var(--cc-brand-600)]" strokeWidth={1.75} />
                Your plan has been cancelled
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                You'll continue to have full access to <span className="font-medium">{plan.name}</span> until{" "}
                <span className="font-medium">{formatLongDate(accessUntil)}</span>. After that, your account will
                move to a read-only state.
              </p>
              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                  {error}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <button
                type="button"
                onClick={() => handleClose(false)}
                disabled={busy}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
              >
                Close
              </button>
              <Button
                onClick={() => { setError(null); reactivateMutation.mutate(); }}
                disabled={busy}
                className="bg-[color:var(--cc-brand-600)] hover:bg-[color:var(--cc-brand-700)] text-white"
              >
                {reactivateMutation.isPending ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" /> Reactivating…</>
                ) : "Reactivate my plan"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Standalone one-click reactivate mutation for the plan card CTA when a
 * cancellation is pending but the user hasn't opened the modal.
 */
export function useReactivatePlan() {
  const { plan, refetch } = usePlan();
  const reactivateFn = useServerFn(reactivatePlan);
  return useMutation({
    mutationFn: () => reactivateFn({}),
    onSuccess: () => {
      refetch();
      toast.success(`Welcome back — your ${plan.name} plan will continue without interruption.`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    },
  });
}