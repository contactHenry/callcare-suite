/**
 * Feature-gate utility — the ONLY place plan features are checked in the app.
 * Never inline `plan.features.xyz` in components. Always route through here.
 */

export type FeatureKey =
  | "call_recording"
  | "call_recording_review"
  | "live_monitoring"
  | "whisper_barge_takeover"
  | "qa_scorecards"
  | "campaign_management"
  | "advanced_reporting"
  | "compliance_centre"
  | "audit_logs"
  | "workflow_automation"
  | "crm_integrations"
  | "multi_department"
  | "sso"
  | "advanced_roles"
  | "white_label"
  | "multi_site"
  | "api_access"
  | "custom_integrations"
  | "dedicated_infrastructure"
  | "task_management"
  | "follow_up_scheduling"
  | "client_management"
  | "inbound_outbound_calling"
  | "click_to_call"
  | "call_notes_outcomes"
  | "basic_dashboard";

export type PlanFeatures = Record<FeatureKey, boolean>;

export type PlanName = "Starter" | "Growth" | "Professional" | "Business" | "Enterprise";

/** True when the plan's feature map explicitly has this feature enabled. */
export function hasFeature(features: PlanFeatures | null | undefined, key: FeatureKey): boolean {
  if (!features) return false;
  return features[key] === true;
}

/** Minimum plan tier that unlocks the given feature — used for upgrade prompts. */
export function getMinPlanForFeature(key: FeatureKey): PlanName {
  const map: Record<FeatureKey, PlanName> = {
    call_recording:           "Growth",
    call_recording_review:    "Growth",
    live_monitoring:          "Professional",
    whisper_barge_takeover:   "Professional",
    qa_scorecards:            "Growth",
    campaign_management:      "Growth",
    advanced_reporting:       "Professional",
    compliance_centre:        "Professional",
    audit_logs:               "Professional",
    workflow_automation:      "Professional",
    crm_integrations:         "Professional",
    multi_department:         "Professional",
    sso:                      "Business",
    advanced_roles:           "Business",
    white_label:              "Business",
    multi_site:               "Business",
    api_access:               "Growth",
    custom_integrations:      "Enterprise",
    dedicated_infrastructure: "Enterprise",
    task_management:          "Starter",
    follow_up_scheduling:     "Starter",
    client_management:        "Starter",
    inbound_outbound_calling: "Starter",
    click_to_call:            "Starter",
    call_notes_outcomes:      "Starter",
    basic_dashboard:          "Starter",
  };
  return map[key];
}