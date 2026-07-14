import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

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

const DAY = 24 * 60 * 60 * 1000;

async function assertOpsAdmin(context: { supabase: any; userId: string }) {
  const { supabase, userId } = context;
  const { data: ops } = await supabase.rpc("has_role", { _user_id: userId, _role: "ops_admin" });
  const { data: sup } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!ops && !sup) throw new Error("Only administrators can change the plan.");
}

async function resolveOrgId(context: { supabase: any; userId: string }) {
  const { supabase, userId } = context;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const orgId = profile?.organization_id as string | undefined;
  if (!orgId) throw new Error("No organization for current user");
  return orgId;
}

/**
 * Upgrade / change the org's plan. Requires ops_admin or super_admin.
 * Handles both trial → active conversion and mid-cycle plan swaps.
 */
export const initiateUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      newPlanId: z.string().uuid(),
      billingCycle: z.enum(["monthly", "annual"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as { supabase: any; userId: string };
    await assertOpsAdmin(ctx);
    const orgId = await resolveOrgId(ctx);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: newPlan, error: perr } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("id", data.newPlanId)
      .maybeSingle();
    if (perr) throw new Error(perr.message);
    if (!newPlan) throw new Error("Plan not found");
    if (newPlan.is_enterprise) {
      throw new Error("Enterprise plans require sales — use the contact form.");
    }

    const { data: existing } = await supabaseAdmin
      .from("org_subscriptions")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();

    const now = new Date();
    const cycleMs = data.billingCycle === "annual" ? 365 * DAY : 30 * DAY;
    const periodEnd = new Date(now.getTime() + cycleMs);

    const fromPlanId = existing?.plan_id ?? null;
    const isTrialConversion = !existing || existing.status === "trial";

    const payload = {
      org_id: orgId,
      plan_id: newPlan.id,
      status: "active",
      billing_cycle: data.billingCycle,
      cancel_at_period_end: false,
      cancelled_at: null,
      current_period_start: isTrialConversion
        ? now.toISOString()
        : existing?.current_period_start ?? now.toISOString(),
      current_period_end: isTrialConversion
        ? periodEnd.toISOString()
        : existing?.current_period_end ?? periodEnd.toISOString(),
      trial_ends_at: existing?.trial_ends_at ?? null,
      updated_at: now.toISOString(),
    };

    const { data: upserted, error: uerr } = await supabaseAdmin
      .from("org_subscriptions")
      .upsert(payload, { onConflict: "org_id" })
      .select("*")
      .single();
    if (uerr) throw new Error(uerr.message);

    const eventType = isTrialConversion ? "trial_converted" : "plan_upgraded";
    await supabaseAdmin.from("subscription_events").insert({
      org_id: orgId,
      event_type: eventType,
      from_plan_id: fromPlanId,
      to_plan_id: newPlan.id,
      metadata: {
        billing_cycle: data.billingCycle,
        amount_monthly: newPlan.price_monthly,
        amount_annual: newPlan.price_annual,
        actor_id: ctx.userId,
      },
    });

    return { ok: true as const, newSubscription: upserted, plan: newPlan };
  });

/**
 * Records an enterprise sales enquiry as a subscription_event.
 * Real email/CRM delivery is out of scope until Phase 6.
 */
export const submitEnterpriseEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      name: z.string().min(1).max(200),
      email: z.string().email().max(320),
      companySize: z.string().min(1).max(50),
      message: z.string().max(2000).optional().default(""),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as { supabase: any; userId: string };
    const orgId = await resolveOrgId(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("subscription_events").insert({
      org_id: orgId,
      event_type: "enterprise_enquiry",
      from_plan_id: null,
      to_plan_id: null,
      metadata: {
        name: data.name,
        email: data.email,
        company_size: data.companySize,
        message: data.message,
        actor_id: ctx.userId,
      },
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });