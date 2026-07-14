import type { ReactNode } from "react";
import { usePlan } from "@/contexts/PlanContext";
import type { FeatureKey } from "@/lib/billing/gates";
import { UpgradePrompt } from "./UpgradePrompt";

export interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  mode?: "hide" | "lock";
}

/**
 * Wraps UI that requires a plan feature. Route this through the gate
 * utility instead of inspecting `plan.features` inline.
 */
export function FeatureGate({ feature, children, fallback, mode = "lock" }: FeatureGateProps) {
  const { can } = usePlan();
  if (can(feature)) return <>{children}</>;
  if (mode === "hide") return null;
  return <>{fallback ?? <UpgradePrompt feature={feature} />}</>;
}