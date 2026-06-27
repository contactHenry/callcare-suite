import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listOutcomes, saveCallNote } from "@/lib/workflow.functions";
import {
  CCFormSection, CCFormGrid, CCField, CCInput, CCTextarea, CCChoiceGroup, CCCheckbox, CCButton,
} from "@/components/cc";

type Priority = "low" | "normal" | "high" | "urgent";

/**
 * The shared after-call form. Reused on the call-detail screen and any
 * other surface that needs to capture an outcome. Outcomes are loaded
 * from the campaign's configurable list.
 */
export function AfterCallForm({
  callId,
  campaignId,
  onSaved,
}: {
  callId: string;
  campaignId?: string | null;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const { data: outcomes = [] } = useQuery({
    queryKey: ["outcomes", campaignId ?? null],
    queryFn: () => listOutcomes({ data: { campaignId: campaignId ?? null } }),
  });

  const [outcome, setOutcome] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [concerns, setConcerns] = useState("");
  const [action, setAction] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [complaint, setComplaint] = useState(false);
  const [consent, setConsent] = useState("");
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [followUpAt, setFollowUpAt] = useState("");

  // Auto-toggle follow-up when outcome requires it
  useEffect(() => {
    const o = outcomes.find((o: any) => o.code === outcome);
    if (o?.requires_follow_up) setNeedsFollowUp(true);
  }, [outcome, outcomes]);

  const save = useMutation({
    mutationFn: () => saveCallNote({
      data: {
        callId,
        outcomeCode: outcome ?? undefined,
        summary, concerns, actionRequired: action,
        priority, complaint, consentUpdate: consent || undefined,
        followUp: needsFollowUp && followUpAt
          ? { dueAt: new Date(followUpAt).toISOString() }
          : null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["call", callId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onSaved?.();
    },
  });

  return (
    <CCFormSection title="After-call wrap-up" hint="Captured against this call and audit-logged.">
      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--cc-ink-500)]">Outcome</span>
        <CCChoiceGroup
          ariaLabel="Outcome"
          value={outcome}
          onChange={setOutcome}
          options={
            outcomes.length
              ? outcomes.map((o: any) => ({ value: o.code, label: o.label, tone: o.polarity }))
              : [
                  { value: "resolved", label: "Resolved", tone: "positive" as const },
                  { value: "follow_up", label: "Follow up", tone: "neutral" as const },
                  { value: "no_answer", label: "No answer", tone: "negative" as const },
                  { value: "escalated", label: "Escalated", tone: "negative" as const },
                ]
          }
        />
      </div>

      <CCFormGrid>
        <CCField label="Summary">
          <CCTextarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What did you discuss?" />
        </CCField>
        <CCField label="Concerns">
          <CCTextarea value={concerns} onChange={(e) => setConcerns(e.target.value)} placeholder="Risks or sensitivities" />
        </CCField>
        <CCField label="Action required">
          <CCTextarea value={action} onChange={(e) => setAction(e.target.value)} placeholder="Next step (owner + ETA)" />
        </CCField>
        <CCField label="Consent update">
          <CCInput value={consent} onChange={(e) => setConsent(e.target.value)} placeholder="e.g. granted SMS marketing" />
        </CCField>
      </CCFormGrid>

      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--cc-ink-500)]">Priority</span>
        <CCChoiceGroup
          ariaLabel="Priority"
          value={priority}
          onChange={(v) => setPriority(v as Priority)}
          options={[
            { value: "low", label: "Low", tone: "neutral" },
            { value: "normal", label: "Normal", tone: "neutral" },
            { value: "high", label: "High", tone: "negative" },
            { value: "urgent", label: "Urgent", tone: "negative" },
          ]}
        />
      </div>

      <CCCheckbox
        checked={complaint}
        onChange={setComplaint}
        label="Flag this call as a complaint"
        hint="Routed to QA & Compliance review."
      />

      <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] p-3 space-y-2">
        <CCCheckbox
          checked={needsFollowUp}
          onChange={setNeedsFollowUp}
          label="Schedule a follow-up task"
        />
        {needsFollowUp && (
          <CCField label="Due date / time">
            <CCInput
              type="datetime-local"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
            />
          </CCField>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[color:var(--cc-ink-100)]">
        {save.isError && <span className="text-xs text-[color:var(--cc-danger)]">Could not save</span>}
        {save.isSuccess && <span className="text-xs text-[color:var(--cc-success)]">Saved ✓</span>}
        <CCButton
          onClick={() => save.mutate()}
          disabled={!outcome || save.isPending}
        >
          {save.isPending ? "Saving…" : "Save wrap-up"}
        </CCButton>
      </div>
    </CCFormSection>
  );
}