import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrgSubscription,
  type OrgSubscription,
  type SubscriptionPlan,
} from "@/lib/billing/subscription.functions";
import { hasFeature, type FeatureKey, type PlanFeatures } from "@/lib/billing/gates";

export interface PlanContextValue {
  plan: SubscriptionPlan;
  subscription: OrgSubscription;
  can: (feature: FeatureKey) => boolean;
  daysLeftInTrial: number | null;
  isTrialExpired: boolean;
  isCancelled: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  refetch: () => void;
}

export const PlanContext = createContext<PlanContextValue | null>(null);

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan() must be used inside <PlanProvider>");
  return ctx;
}

/**
 * Loads the org subscription once per session (5-minute stale window) and
 * exposes it plus a `can(feature)` gate to every descendant.
 */
export function PlanProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const qc = useQueryClient();
  const queryKey = ["org-subscription", userId];

  const { data } = useQuery({
    queryKey,
    queryFn: () => getOrgSubscription(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refetch = useCallback(() => {
    void qc.invalidateQueries({ queryKey });
    // queryKey is a stable primitive list; safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, userId]);

  if (!data) return null;

  const value: PlanContextValue = {
    plan: data.plan,
    subscription: data.subscription,
    can: (feature) => hasFeature(data.plan.features as unknown as PlanFeatures, feature),
    daysLeftInTrial: data.daysLeftInTrial,
    isTrialExpired: data.isTrialExpired,
    isCancelled: data.isCancelled,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    currentPeriodEnd: data.currentPeriodEnd,
    refetch,
  };

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}