import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type SubscriptionPlan = Database["public"]["Tables"]["subscription_plans"]["Row"];
export type OrgSubscription = Database["public"]["Tables"]["org_subscriptions"]["Row"];

export interface OrgSubscriptionResult {
  subscription: OrgSubscription;
  plan: SubscriptionPlan;
  daysLeftInTrial: number | null;
  isTrialExpired: boolean;
  isCancelled: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Loads the current org's subscription + plan.
 * If the org has no row yet, synthesises a 7-day Starter trial from
 * organizations.created_at so pre-existing tenants aren't locked out.
 */
export const getOrgSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const { data: profile, error: perr } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (perr) throw new Error(perr.message);
    const orgId: string | null = profile?.organization_id ?? null;
    if (!orgId) throw new Error("No organization for current user");

    const { data: joined } = await supabase
      .from("org_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("org_id", orgId)
      .maybeSingle();

    let subscription: OrgSubscription;
    let plan: SubscriptionPlan;

    if (joined && joined.plan) {
      const { plan: p, ...rest } = joined as any;
      subscription = rest as OrgSubscription;
      plan = p as SubscriptionPlan;
    } else {
      const { data: starter } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("slug", "starter")
        .maybeSingle();
      if (!starter) throw new Error("Starter plan is not seeded");
      plan = starter as SubscriptionPlan;

      const { data: org } = await supabase
        .from("organizations")
        .select("created_at")
        .eq("id", orgId)
        .maybeSingle();
      const created = org?.created_at ? new Date(org.created_at) : new Date();
      const trialEnd = new Date(created.getTime() + 7 * DAY_MS);
      subscription = {
        id: "synthetic",
        org_id: orgId,
        plan_id: plan.id,
        status: "trial",
        billing_cycle: "monthly",
        trial_ends_at: trialEnd.toISOString(),
        current_period_start: created.toISOString(),
        current_period_end: trialEnd.toISOString(),
        cancel_at_period_end: false,
        cancelled_at: null,
        stripe_subscription_id: null,
        stripe_customer_id: null,
        created_at: created.toISOString(),
        updated_at: created.toISOString(),
      };
    }

    const now = Date.now();
    let daysLeftInTrial: number | null = null;
    let isTrialExpired = false;
    if (subscription.status === "trial" && subscription.trial_ends_at) {
      const diff = new Date(subscription.trial_ends_at).getTime() - now;
      daysLeftInTrial = Math.max(0, Math.ceil(diff / DAY_MS));
      isTrialExpired = diff <= 0;
    }
    const isCancelled = subscription.status === "cancelled";

    return {
      subscription,
      plan,
      daysLeftInTrial,
      isTrialExpired,
      isCancelled,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscription.current_period_end,
    } satisfies OrgSubscriptionResult;
  });