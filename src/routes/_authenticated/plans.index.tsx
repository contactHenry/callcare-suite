import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/contexts/PlanContext";
import { UpgradeModal } from "@/components/cc/UpgradeModal";
import { EnterpriseContactModal } from "@/components/cc/EnterpriseContactModal";
import { CancelPlanModal, useReactivatePlan } from "@/components/cc/CancelPlanModal";
import type { SubscriptionPlan } from "@/lib/billing/subscription.functions";
import type { PlanFeatures, FeatureKey } from "@/lib/billing/gates";
import { UPGRADE_DISABLED_TOOLTIP } from "@/lib/billing/authorization";

export const Route = createFileRoute("/_authenticated/plans/")({
  component: PlansPage,
});

const HIGHLIGHT_FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "call_recording", label: "Call recording" },
  { key: "qa_scorecards", label: "QA scorecards" },
  { key: "live_monitoring", label: "Live monitoring" },
  { key: "whisper_barge_takeover", label: "Whisper, barge & takeover" },
  { key: "compliance_centre", label: "Compliance centre" },
  { key: "advanced_reporting", label: "Advanced reporting" },
  { key: "sso", label: "SSO" },
  { key: "api_access", label: "API access" },
];

function gbp(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  return `£${Number(v).toLocaleString("en-GB")}`;
}

function PlansPage() {
  const { atLeast, user } = useAuth();
  const canUpgrade = atLeast("ops_admin");
  const { plan: currentPlan, subscription, cancelAtPeriodEnd, currentPeriodEnd } = usePlan();
  const [cycle, setCycle] = useState<"monthly" | "annual">(
    subscription.billing_cycle === "annual" ? "annual" : "monthly",
  );
  const [upgradeTarget, setUpgradeTarget] = useState<SubscriptionPlan | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const reactivate = useReactivatePlan();
  const cancelsOnLabel = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const plansQ = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as SubscriptionPlan[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans & Billing"
        description="Choose the plan that matches your team. Change anytime."
      />

      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-lg border p-1">
          <button
            onClick={() => setCycle("monthly")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${cycle === "monthly" ? "bg-[color:var(--cc-brand-600)] text-white" : "text-muted-foreground"}`}
          >Monthly</button>
          <button
            onClick={() => setCycle("annual")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${cycle === "annual" ? "bg-[color:var(--cc-brand-600)] text-white" : "text-muted-foreground"}`}
          >Annual · save up to 15%</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-5">
        {(plansQ.data ?? []).map((plan) => {
          const isCurrent = plan.id === currentPlan.id;
          const features = (plan.features ?? {}) as PlanFeatures;
          const price = cycle === "annual"
            ? Number(plan.price_annual ?? 0) / 12
            : Number(plan.price_monthly ?? 0);

          return (
            <div
              key={plan.id}
              className={`rounded-xl border bg-card p-5 flex flex-col ${plan.is_popular ? "border-[color:var(--cc-brand-600)] ring-1 ring-[color:var(--cc-brand-600)]" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{plan.name}</h3>
                {plan.is_popular && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--cc-brand-600)]/10 px-2 py-0.5 text-xs font-medium text-[color:var(--cc-brand-700)]">
                    <Sparkles className="size-3" /> Popular
                  </span>
                )}
                {isCurrent && !cancelAtPeriodEnd && (
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    Current
                  </span>
                )}
                {isCurrent && cancelAtPeriodEnd && (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    Cancels on {cancelsOnLabel}
                  </span>
                )}
              </div>

              <div className="mt-3">
                {plan.is_enterprise ? (
                  <div className="text-2xl font-semibold">Custom</div>
                ) : (
                  <div>
                    <span className="text-2xl font-semibold">{gbp(Math.round(price))}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                    {cycle === "annual" && Number(plan.price_annual) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        billed {gbp(plan.price_annual)}/yr
                      </div>
                    )}
                  </div>
                )}
              </div>

              <ul className="mt-4 space-y-1.5 text-sm flex-1">
                {plan.max_users != null && (
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 text-emerald-600 shrink-0" strokeWidth={2.25} />
                    <span>Up to {plan.max_users} users</span>
                  </li>
                )}
                {HIGHLIGHT_FEATURES.filter((f) => features[f.key]).slice(0, 6).map((f) => (
                  <li key={f.key} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 text-emerald-600 shrink-0" strokeWidth={2.25} />
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {isCurrent ? (
                  cancelAtPeriodEnd ? (
                    <Button
                      onClick={() => reactivate.mutate()}
                      disabled={!canUpgrade || reactivate.isPending}
                      className="w-full bg-[color:var(--cc-brand-600)] hover:bg-[color:var(--cc-brand-700)] text-white"
                    >
                      {reactivate.isPending ? "Reactivating…" : "Reactivate plan"}
                    </Button>
                  ) : (
                    <Button variant="outline" disabled className="w-full">Current plan</Button>
                  )
                ) : plan.is_enterprise ? (
                  <Button
                    onClick={() => setContactOpen(true)}
                    variant="outline"
                    className="w-full"
                  >Contact us</Button>
                ) : (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block w-full">
                          <Button
                            onClick={() => setUpgradeTarget(plan)}
                            disabled={!canUpgrade}
                            className="w-full bg-[color:var(--cc-brand-600)] hover:bg-[color:var(--cc-brand-700)] text-white"
                          >
                            Upgrade to {plan.name}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!canUpgrade && (
                        <TooltipContent>{UPGRADE_DISABLED_TOOLTIP}</TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canUpgrade && !cancelAtPeriodEnd && subscription.status !== "trial" && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Cancel plan
          </button>
        </div>
      )}

      <CancelPlanModal open={cancelOpen} onOpenChange={setCancelOpen} />

      {upgradeTarget && (
        <UpgradeModal
          open={!!upgradeTarget}
          onOpenChange={(v) => { if (!v) setUpgradeTarget(null); }}
          targetPlan={upgradeTarget}
          initialCycle={cycle}
          canUpgrade={canUpgrade}
        />
      )}
      <EnterpriseContactModal
        open={contactOpen}
        onOpenChange={setContactOpen}
        defaultName={(user?.user_metadata?.full_name as string) ?? ""}
        defaultEmail={user?.email ?? ""}
      />
    </div>
  );
}