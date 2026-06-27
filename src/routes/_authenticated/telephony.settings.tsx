import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle } from "lucide-react";
import { getTelephonySettings, saveTelephonySettings } from "@/lib/calls.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/telephony/settings")({
  component: TelephonySettings,
});

function TelephonySettings() {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => { setForm(await getTelephonySettings()); })(); }, []);

  if (!form) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  function update<K extends string>(k: K, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function save() {
    setSaving(true);
    try {
      await saveTelephonySettings({ data: {
        provider: form.provider,
        recordingEnabled: form.recording_enabled,
        consentNotice: form.recording_consent_notice ?? "",
        consentRequired: form.recording_consent_required,
        voicemailDropEnabled: form.voicemail_drop_enabled,
        voicemailLegalAck: form.voicemail_drop_legal_ack,
        twoPartyConsentRegions: form.two_party_consent_regions ?? [],
      }});
      toast.success("Telephony settings saved");
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Telephony settings" description="Provider, recording policy, and per-jurisdiction compliance configuration." />
      <div className="p-6 max-w-3xl space-y-8">
        <Section title="Provider">
          <Field label="Provider">
            <select
              className="border rounded h-9 px-2 text-sm w-full"
              value={form.provider}
              onChange={(e) => update("provider", e.target.value)}
            >
              <option value="stub">Stub (no real calls)</option>
              <option value="twilio">Twilio</option>
              <option value="sinch">Sinch</option>
              <option value="vonage">Vonage</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Provider integration is abstracted — business logic never depends on the choice here.
            </p>
          </Field>
        </Section>

        <Section title="Recording">
          <Toggle label="Record calls automatically"
            checked={!!form.recording_enabled}
            onChange={(v) => update("recording_enabled", v)} />
          <Toggle label="Require consent notice on every call"
            checked={!!form.recording_consent_required}
            onChange={(v) => update("recording_consent_required", v)} />
          <Field label="Consent notice text">
            <Textarea rows={3}
              value={form.recording_consent_notice ?? ""}
              onChange={(e) => update("recording_consent_notice", e.target.value)} />
          </Field>
          <Field label="Two-party-consent regions (comma-separated, e.g. CA, FL)">
            <Input
              value={(form.two_party_consent_regions ?? []).join(", ")}
              onChange={(e) => update("two_party_consent_regions",
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            <p className="text-xs text-muted-foreground mt-1">
              Recording consent legal requirements vary by jurisdiction — list any region requiring all-party consent.
            </p>
          </Field>
        </Section>

        <Section title="Voicemail drop">
          <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded p-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              Pre-recorded voicemail drops may be regulated under TCPA / consumer-protection laws
              in your jurisdiction. Confirm legal review before enabling.
            </span>
          </div>
          <Toggle label="Enable voicemail drop feature"
            checked={!!form.voicemail_drop_enabled}
            onChange={(v) => update("voicemail_drop_enabled", v)} />
          <Toggle label="I confirm legal review has been completed for this organization"
            checked={!!form.voicemail_drop_legal_ack}
            onChange={(v) => update("voicemail_drop_legal_ack", v)} />
        </Section>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="space-y-4 border rounded-lg p-4 bg-card">{children}</div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}