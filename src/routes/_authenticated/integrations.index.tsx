import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCStatusPill, CCWidget } from "@/components/cc";

export const Route = createFileRoute("/_authenticated/integrations/")({
  component: IntegrationsPage,
});

const CATALOG: { provider: string; category: string; description: string }[] = [
  { provider: "Twilio Voice", category: "telephony", description: "Cloud voice provider for inbound/outbound calls and recordings." },
  { provider: "SendGrid", category: "email", description: "Transactional email for notifications and reports." },
  { provider: "Twilio SMS", category: "sms", description: "Outbound SMS for client and agent notifications." },
  { provider: "HubSpot", category: "crm", description: "Two-way sync of contacts and activity to your CRM." },
  { provider: "Stripe", category: "payments", description: "Take payments and reconcile against client records." },
  { provider: "Calendly", category: "booking", description: "Surface appointment slots inside the agent screen." },
  { provider: "Zendesk", category: "support", description: "Open and link tickets from a call record." },
  { provider: "WhatsApp Business", category: "messaging", description: "Receive and send WhatsApp messages on a verified number." },
  { provider: "Google Calendar", category: "calendar", description: "Sync follow-ups and shifts to agent calendars." },
  { provider: "Microsoft Outlook", category: "calendar", description: "Sync follow-ups and shifts to agent calendars." },
  { provider: "Power BI", category: "bi", description: "Stream call and QA metrics to a BI workspace." },
  { provider: "Onfido", category: "kyc", description: "Identity verification during onboarding calls." },
  { provider: "Amazon S3", category: "storage", description: "Mirror call recordings for long-term retention." },
];

function IntegrationsPage() {
  const { atLeast } = useAuth();
  const qc = useQueryClient();
  const canEdit = atLeast("ops_admin");

  const enabled = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data } = await supabase.from("integrations" as any).select("*");
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async (entry: { provider: string; category: string; current?: any }) => {
      if (entry.current) {
        const nextStatus = entry.current.status === "connected" ? "disabled" : "connected";
        await supabase.from("integrations" as any).update({ status: nextStatus }).eq("id", entry.current.id);
      } else {
        await supabase.from("integrations" as any).insert({
          provider: entry.provider, category: entry.category, status: "connected",
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const apiRows = (enabled.data ?? []) as any[];
  const DUMMY_STATE: Record<string, string> = {
    "Twilio Voice": "connected", "SendGrid": "connected", "Twilio SMS": "connected",
    "HubSpot": "connected", "Stripe": "error", "Calendly": "disabled",
    "Zendesk": "connected", "WhatsApp Business": "disabled", "Google Calendar": "connected",
    "Microsoft Outlook": "disabled", "Power BI": "connected", "Onfido": "disabled",
    "Amazon S3": "connected",
  };
  const seedRows = apiRows.length > 0 ? apiRows
    : CATALOG.map((c, i) => ({ id: `seed-${i}`, provider: c.provider, category: c.category, status: DUMMY_STATE[c.provider] ?? "disabled" }));
  const byProvider = new Map<string, any>(seedRows.map((i: any) => [i.provider, i]));

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect external services. Connections are scoped to your organisation."
      />
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG.map((c) => {
            const current = byProvider.get(c.provider);
            const tone: any = current?.status === "connected" ? "success"
              : current?.status === "error" ? "danger" : "neutral";
            return (
              <CCWidget key={c.provider} title={c.provider}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wide text-[color:var(--cc-ink-500)]">{c.category}</span>
                  <CCStatusPill tone={tone} dot>{current?.status ?? "disabled"}</CCStatusPill>
                </div>
                <p className="text-sm text-[color:var(--cc-ink-700)] mb-3 min-h-[40px]">{c.description}</p>
                {canEdit ? (
                  <CCButton
                    size="sm"
                    variant={current?.status === "connected" ? "secondary" : "primary"}
                    onClick={() => toggle.mutate({ provider: c.provider, category: c.category, current })}
                  >
                    {current?.status === "connected" ? "Disconnect" : "Connect"}
                  </CCButton>
                ) : (
                  <span className="text-xs text-[color:var(--cc-ink-500)]">Ops admin required to configure.</span>
                )}
              </CCWidget>
            );
          })}
        </div>
      </div>
    </>
  );
}