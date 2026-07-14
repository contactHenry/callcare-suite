import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { initiateUpgrade, type SubscriptionPlan } from "@/lib/billing/subscription.functions";
import { usePlan } from "@/contexts/PlanContext";
import type { PlanFeatures, FeatureKey } from "@/lib/billing/gates";

const FEATURE_LABELS: Partial<Record<FeatureKey, string>> = {
  call_recording: "Call recording",
  call_recording_review: "Recording review & playback",
  live_monitoring: "Live call monitoring",
  whisper_barge_takeover: "Whisper, barge & takeover",
  qa_scorecards: "QA scorecards",
  campaign_management: "Campaign management",
  advanced_reporting: "Advanced reporting",
  compliance_centre: "Compliance centre",
  audit_logs: "Audit logs",
  workflow_automation: "Workflow automation",
  crm_integrations: "CRM integrations",
  multi_department: "Multi-department",
  sso: "Single sign-on (SSO)",
  advanced_roles: "Custom roles",
  white_label: "White-label branding",
  multi_site: "Multi-site",
  api_access: "API access",
  custom_integrations: "Custom integrations",
  dedicated_infrastructure: "Dedicated infrastructure",
};

function gbp(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  return `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function diffFeatures(current: PlanFeatures, next: PlanFeatures): FeatureKey[] {
  const out: FeatureKey[] = [];
  for (const key of Object.keys(next) as FeatureKey[]) {
    if (next[key] === true && current[key] !== true) out.push(key);
  }
  return out;
}

export interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan: SubscriptionPlan;
  initialCycle?: "monthly" | "annual";
  canUpgrade?: boolean;
}

export function UpgradeModal({
  open,
  onOpenChange,
  targetPlan,
  initialCycle = "monthly",
  canUpgrade = true,
}: UpgradeModalProps) {
  const { plan: currentPlan, subscription, refetch } = usePlan();
  const currentFeatures = (currentPlan.features ?? {}) as PlanFeatures;
  const nextFeatures = (targetPlan.features ?? {}) as PlanFeatures;

  const gained = useMemo(
    () => diffFeatures(currentFeatures, nextFeatures).slice(0, 5),
    [currentFeatures, nextFeatures],
  );

  const alreadyAnnual = subscription.billing_cycle === "annual";
  const [cycle, setCycle] = useState<"monthly" | "annual">(
    alreadyAnnual ? "annual" : initialCycle,
  );
  const [error, setError] = useState<string | null>(null);

  const upgradeFn = useServerFn(initiateUpgrade);
  const mutation = useMutation({
    mutationFn: (vars: { newPlanId: string; billingCycle: "monthly" | "annual" }) =>
      upgradeFn({ data: vars }),
    onSuccess: () => {
      const newFeatureCount = gained.length;
      refetch();
      onOpenChange(false);
      toast.success(
        `Welcome to ${targetPlan.name}! You now have access to ${newFeatureCount} new feature${newFeatureCount === 1 ? "" : "s"}.`,
        { duration: 5000 },
      );
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    },
  });

  const currentPrice = Number(currentPlan.price_monthly ?? 0);
  const nextPrice = Number(targetPlan.price_monthly ?? 0);
  const priceDiff = nextPrice - currentPrice;
  const isTrial = subscription.status === "trial";
  const isDowngrade = nextPrice < currentPrice && !isTrial;
  const wasCancelling = subscription.cancel_at_period_end && !isTrial;

  const nextAnnualMonthly = Number(targetPlan.price_annual ?? 0) / 12;
  const nextAnnualTotal = Number(targetPlan.price_annual ?? 0);
  const annualSaving = nextPrice > 0
    ? Math.round((1 - (nextAnnualTotal / (nextPrice * 12))) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!mutation.isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Upgrade to {targetPlan.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 1. Change summary */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">From</div>
                <div className="mt-1 font-medium truncate">{currentPlan.name}</div>
                <div className="text-sm text-muted-foreground">
                  {isTrial ? "Trial" : `${gbp(currentPrice)}/mo`}
                </div>
              </div>
              <ArrowRight className="size-5 text-muted-foreground" strokeWidth={1.75} />
              <div className="min-w-0 text-right">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">To</div>
                <div className="mt-1 font-medium truncate">{targetPlan.name}</div>
                <div className="text-sm text-muted-foreground">{gbp(nextPrice)}/mo</div>
              </div>
            </div>
            <div className="mt-3 border-t pt-3 text-sm">
              {isTrial ? (
                <span className="font-medium">{gbp(nextPrice)}/month from today</span>
              ) : priceDiff > 0 ? (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  + {gbp(priceDiff)}/month
                </span>
              ) : priceDiff < 0 ? (
                <span className="font-medium text-muted-foreground">
                  − {gbp(Math.abs(priceDiff))}/month
                </span>
              ) : (
                <span className="font-medium text-muted-foreground">Same monthly price</span>
              )}
            </div>
          </div>

          {/* 2. What you gain */}
          {gained.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">What you gain</div>
              <ul className="space-y-1.5">
                {gained.map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 text-emerald-600 shrink-0" strokeWidth={2.25} />
                    <span>{FEATURE_LABELS[k] ?? k}</span>
                  </li>
                ))}
                {targetPlan.max_users != null && targetPlan.max_users > (currentPlan.max_users ?? 0) && (
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 text-emerald-600 shrink-0" strokeWidth={2.25} />
                    <span>Up to {targetPlan.max_users} users</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* 3. Billing cycle selector */}
          {!alreadyAnnual && (
            <div>
              <div className="text-sm font-medium mb-2">Billing cycle</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCycle("monthly")}
                  className={`rounded-lg border p-3 text-left transition ${cycle === "monthly" ? "border-[color:var(--cc-brand-600)] ring-1 ring-[color:var(--cc-brand-600)]" : "hover:border-foreground/30"}`}
                >
                  <div className="text-sm font-medium">Monthly</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {gbp(nextPrice)}/month · no commitment
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCycle("annual")}
                  className={`rounded-lg border p-3 text-left transition ${cycle === "annual" ? "border-[color:var(--cc-brand-600)] ring-1 ring-[color:var(--cc-brand-600)]" : "hover:border-foreground/30"}`}
                >
                  <div className="text-sm font-medium">Annual</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {gbp(Math.round(nextAnnualMonthly))}/month · billed {gbp(nextAnnualTotal)}/yr
                    {annualSaving > 0 && <> — Save {annualSaving}%</>}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 4. Payment note */}
          <p className="text-xs text-muted-foreground">
            Your plan will be upgraded immediately. Payment details will be confirmed separately.
          </p>

          {/* 5. Important notes */}
          {isDowngrade && targetPlan.max_users != null && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs">
              Users above {targetPlan.max_users} will remain active until the next billing
              cycle. Please reduce your team size before then.
            </div>
          )}
          {wasCancelling && (
            <div className="rounded-md border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-xs">
              Your previous cancellation has been cancelled. Your plan will continue without interruption.
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate({ newPlanId: targetPlan.id, billingCycle: cycle });
            }}
            disabled={!canUpgrade || mutation.isPending}
            className="bg-[color:var(--cc-brand-600)] hover:bg-[color:var(--cc-brand-700)] text-white"
          >
            {mutation.isPending ? (
              <><Loader2 className="mr-2 size-4 animate-spin" /> Upgrading…</>
            ) : (
              <>Confirm upgrade to {targetPlan.name} <ArrowRight className="ml-1.5 size-4" /></>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}