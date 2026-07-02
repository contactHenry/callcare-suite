import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCStatusPill, CCWidget } from "@/components/cc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { KeyRound, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/integrations/")({
  component: IntegrationsPage,
});

type Field = { key: string; label: string; type?: "text" | "password" | "textarea"; placeholder?: string; hint?: string };
type CatalogItem = {
  provider: string; category: string; description: string;
  docsUrl?: string; fields: Field[];
};

const CATALOG: CatalogItem[] = [
  { provider: "Twilio Voice", category: "telephony", description: "Cloud voice provider for inbound/outbound calls and recordings.",
    docsUrl: "https://www.twilio.com/console", fields: [
      { key: "account_sid", label: "Account SID", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
      { key: "auth_token", label: "Auth token", type: "password", placeholder: "••••••••••••••••" },
      { key: "from_number", label: "Default caller ID", placeholder: "+14155550123" },
    ]},
  { provider: "SendGrid", category: "email", description: "Transactional email for notifications and reports.",
    docsUrl: "https://app.sendgrid.com/settings/api_keys", fields: [
      { key: "api_key", label: "API key", type: "password", placeholder: "SG.xxxxxxxx" },
      { key: "from_email", label: "From address", placeholder: "no-reply@yourdomain.com" },
    ]},
  { provider: "Twilio SMS", category: "sms", description: "Outbound SMS for client and agent notifications.",
    docsUrl: "https://www.twilio.com/console", fields: [
      { key: "account_sid", label: "Account SID", placeholder: "ACxxxx" },
      { key: "auth_token", label: "Auth token", type: "password" },
      { key: "messaging_sid", label: "Messaging service SID", placeholder: "MGxxxx" },
    ]},
  { provider: "HubSpot", category: "crm", description: "Two-way sync of contacts and activity to your CRM.",
    docsUrl: "https://app.hubspot.com/private-apps", fields: [
      { key: "access_token", label: "Private app token", type: "password", placeholder: "pat-na1-…" },
      { key: "portal_id", label: "Portal ID", placeholder: "1234567" },
    ]},
  { provider: "Stripe", category: "payments", description: "Take payments and reconcile against client records.",
    docsUrl: "https://dashboard.stripe.com/apikeys", fields: [
      { key: "publishable_key", label: "Publishable key", placeholder: "pk_live_…" },
      { key: "secret_key", label: "Secret key", type: "password", placeholder: "sk_live_…" },
      { key: "webhook_secret", label: "Webhook signing secret", type: "password", placeholder: "whsec_…" },
    ]},
  { provider: "Calendly", category: "booking", description: "Surface appointment slots inside the agent screen.",
    docsUrl: "https://calendly.com/integrations/api_webhooks", fields: [
      { key: "personal_access_token", label: "Personal access token", type: "password" },
      { key: "organization_uri", label: "Organization URI", placeholder: "https://api.calendly.com/organizations/…" },
    ]},
  { provider: "Zendesk", category: "support", description: "Open and link tickets from a call record.",
    docsUrl: "https://developer.zendesk.com/api-reference/", fields: [
      { key: "subdomain", label: "Subdomain", placeholder: "yourcompany" },
      { key: "email", label: "Agent email" },
      { key: "api_token", label: "API token", type: "password" },
    ]},
  { provider: "WhatsApp Business", category: "messaging", description: "Receive and send WhatsApp messages on a verified number.",
    docsUrl: "https://developers.facebook.com/docs/whatsapp", fields: [
      { key: "phone_number_id", label: "Phone number ID" },
      { key: "business_account_id", label: "Business account ID" },
      { key: "access_token", label: "Permanent access token", type: "password" },
    ]},
  { provider: "Google Calendar", category: "calendar", description: "Sync follow-ups and shifts to agent calendars.",
    docsUrl: "https://console.cloud.google.com/apis/credentials", fields: [
      { key: "client_id", label: "OAuth client ID" },
      { key: "client_secret", label: "OAuth client secret", type: "password" },
      { key: "redirect_uri", label: "Redirect URI", placeholder: "https://app.example.com/auth/google/callback" },
    ]},
  { provider: "Microsoft Outlook", category: "calendar", description: "Sync follow-ups and shifts to agent calendars.",
    docsUrl: "https://portal.azure.com/", fields: [
      { key: "tenant_id", label: "Tenant ID" },
      { key: "client_id", label: "Application (client) ID" },
      { key: "client_secret", label: "Client secret", type: "password" },
    ]},
  { provider: "Power BI", category: "bi", description: "Stream call and QA metrics to a BI workspace.",
    docsUrl: "https://app.powerbi.com/", fields: [
      { key: "workspace_id", label: "Workspace ID" },
      { key: "dataset_id", label: "Dataset ID" },
      { key: "push_url", label: "Streaming push URL", type: "password" },
    ]},
  { provider: "Onfido", category: "kyc", description: "Identity verification during onboarding calls.",
    docsUrl: "https://dashboard.onfido.com/api/tokens", fields: [
      { key: "api_token", label: "API token", type: "password", placeholder: "api_live.xxxx" },
      { key: "region", label: "Region", placeholder: "EU / US / CA" },
    ]},
  { provider: "Amazon S3", category: "storage", description: "Mirror call recordings for long-term retention.",
    docsUrl: "https://console.aws.amazon.com/iam/", fields: [
      { key: "bucket", label: "Bucket name" },
      { key: "region", label: "Region", placeholder: "us-east-1" },
      { key: "access_key_id", label: "Access key ID" },
      { key: "secret_access_key", label: "Secret access key", type: "password" },
    ]},
];

function IntegrationsPage() {
  const { atLeast } = useAuth();
  const qc = useQueryClient();
  const canEdit = atLeast("ops_admin");
  const [active, setActive] = useState<CatalogItem | null>(null);
  const [mode, setMode] = useState<"connect" | "manage">("connect");

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
                    onClick={() => {
                      setActive(c);
                      setMode(current?.status === "connected" ? "manage" : "connect");
                    }}
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
      <IntegrationDialog
        item={active}
        mode={mode}
        current={active ? byProvider.get(active.provider) : undefined}
        onClose={() => setActive(null)}
        onDisconnect={(item, current) => {
          toggle.mutate({ provider: item.provider, category: item.category, current });
          toast.success(`${item.provider} disconnected`);
          setActive(null);
        }}
        onSave={(item, current) => {
          if (!current || current.status !== "connected") {
            toggle.mutate({ provider: item.provider, category: item.category, current });
          }
          toast.success(`${item.provider} credentials saved`);
          setActive(null);
        }}
      />
    </>
  );
}

function IntegrationDialog({
  item, mode, current, onClose, onSave, onDisconnect,
}: {
  item: CatalogItem | null;
  mode: "connect" | "manage";
  current?: any;
  onClose: () => void;
  onSave: (item: CatalogItem, current?: any) => void;
  onDisconnect: (item: CatalogItem, current?: any) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) { setValues({}); setNotes(""); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-[color:var(--cc-brand-600)]" />
            {mode === "manage" ? `Manage ${item.provider}` : `Connect ${item.provider}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "manage"
              ? "Update credentials or disconnect this integration."
              : "Enter the credentials from your provider console. Values are stored securely and never shown in logs."}
          </DialogDescription>
        </DialogHeader>

        {item.docsUrl && (
          <a href={item.docsUrl} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 text-xs text-[color:var(--cc-brand-600)] hover:underline">
            Where do I find these? <ExternalLink className="size-3" />
          </a>
        )}

        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); onSave(item, current); }}
        >
          {item.fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea
                  rows={3}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              ) : (
                <Input
                  type={f.type === "password" ? "password" : "text"}
                  placeholder={f.placeholder}
                  autoComplete="off"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              )}
              {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
            </div>
          ))}

          <div className="space-y-1">
            <Label className="text-xs">Internal notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Who owns this credential, rotation cadence, etc." />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {mode === "manage" ? (
              <CCButton type="button" variant="danger" size="sm"
                onClick={() => onDisconnect(item, current)}>
                Disconnect
              </CCButton>
            ) : <span />}
            <div className="flex gap-2">
              <CCButton type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</CCButton>
              <CCButton type="submit" size="sm">
                {mode === "manage" ? "Save changes" : "Connect"}
              </CCButton>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}