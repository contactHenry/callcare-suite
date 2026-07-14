import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { usePlan } from "@/contexts/PlanContext";
import { cn } from "@/lib/utils";

type BannerState = "trial-soon" | "expired" | "cancelled";

function resolveState(args: {
  status: string;
  daysLeftInTrial: number | null;
  isTrialExpired: boolean;
  isCancelled: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}): BannerState | null {
  if (args.isTrialExpired) return "expired";
  if (args.status === "trial" && args.daysLeftInTrial !== null && args.daysLeftInTrial <= 7) {
    return "trial-soon";
  }
  if (
    (args.isCancelled || args.cancelAtPeriodEnd) &&
    args.currentPeriodEnd &&
    new Date(args.currentPeriodEnd).getTime() > Date.now()
  ) {
    return "cancelled";
  }
  return null;
}

/**
 * Full-width strip below the app top bar. Amber for warnings, red for a
 * hard-expired trial (non-dismissible). Suppressed entirely when the
 * subscription is healthy.
 */
export function TrialBanner() {
  const { plan, subscription, daysLeftInTrial, isTrialExpired, isCancelled, cancelAtPeriodEnd, currentPeriodEnd } = usePlan();
  const [dismissed, setDismissed] = useState(false);

  const state = resolveState({
    status: subscription.status,
    daysLeftInTrial,
    isTrialExpired,
    isCancelled,
    cancelAtPeriodEnd,
    currentPeriodEnd,
  });
  if (!state) return null;

  const isRed = state === "expired";
  if (dismissed && !isRed) return null;

  const message =
    state === "expired"
      ? "Your trial has ended. Upgrade to continue using the platform."
      : state === "cancelled"
        ? `Your ${plan.name} plan ends on ${new Date(currentPeriodEnd!).toLocaleDateString()}. You can reactivate anytime.`
        : `Your trial ends in ${daysLeftInTrial} day${daysLeftInTrial === 1 ? "" : "s"}. Choose a plan to keep access.`;

  const ctaLabel =
    state === "cancelled" ? "Reactivate →" : state === "expired" ? "Choose a plan →" : "View plans →";

  return (
    <div
      role={isRed ? "alert" : "status"}
      className={cn(
        "h-11 flex items-center justify-between gap-4 px-6 text-sm border-b",
        isRed
          ? "bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]"
          : "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
        <span className="font-medium truncate">{message}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <a href="/plans" className="font-semibold underline underline-offset-2 hover:no-underline">
          {ctaLabel}
        </a>
        {!isRed && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="opacity-70 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** True when the platform's feature nav should be muted (post-trial hard-block). */
export function useIsHardLocked(): boolean {
  const { isTrialExpired } = usePlan();
  return isTrialExpired;
}