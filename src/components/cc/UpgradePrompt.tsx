import { Lock } from "lucide-react";
import type { FeatureKey } from "@/lib/billing/gates";
import { getMinPlanForFeature } from "@/lib/billing/gates";

const FEATURE_COPY: Partial<Record<FeatureKey, string>> = {
  call_recording: "Automatically record inbound and outbound calls for review and coaching.",
  call_recording_review: "Play back call recordings with search, filters and disposition context.",
  live_monitoring: "Watch active calls in real time to coach agents as they happen.",
  whisper_barge_takeover: "Whisper to agents mid-call, barge in to help, or take the call over.",
  qa_scorecards: "Score agents against custom scorecards and track quality trends.",
  campaign_management: "Design outbound campaigns with dispositions, scripts and target lists.",
  advanced_reporting: "Cross-team, campaign and agent performance reports with export.",
  compliance_centre: "Consent, data-subject requests and retention controls in one place.",
  audit_logs: "Immutable log of privileged actions across your organisation.",
  workflow_automation: "Trigger tasks, notifications and follow-ups from call events.",
  crm_integrations: "Sync clients and interactions with your existing CRM.",
  multi_department: "Group teams under departments with their own KPIs and rosters.",
  sso: "Sign in through your identity provider (SAML / OIDC).",
  advanced_roles: "Build custom roles from the full permission catalogue.",
  white_label: "Replace Call Centre branding with your own logo and colours.",
  multi_site: "Manage multiple locations or contact centres under one tenant.",
  api_access: "Programmatic access to your call, client and campaign data.",
  custom_integrations: "Bespoke integrations built by our solutions team.",
  dedicated_infrastructure: "Dedicated compute and database for isolation and scale.",
};

export function UpgradePrompt({ feature }: { feature: FeatureKey }) {
  const minPlan = getMinPlanForFeature(feature);
  return (
    <div className="cc-surface border-t-2 border-t-[color:var(--cc-brand-600)] p-6 max-w-lg">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 size-5 text-muted-foreground shrink-0" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">This feature is available on {minPlan} and above.</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {FEATURE_COPY[feature] ?? "Upgrade your plan to unlock this feature."}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <a
              href={`/plans#${feature}`}
              className="inline-flex items-center rounded-md bg-[color:var(--cc-brand-600)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Upgrade to {minPlan}
            </a>
            <a href="/plans" className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Compare all plans
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}