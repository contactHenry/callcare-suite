import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { CCCard, CCStatusPill, CCWidget } from "@/components/cc";
import { useAuth } from "@/lib/auth";
import { Bell, ShieldCheck, Cog, KeyRound, Plug, Settings2, Building2, ScrollText, User, Globe, Palette, Languages, Clock, Headphones } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: SettingsPage,
});

function Tile({ onClick, icon, title, desc, meta, status }: { onClick: () => void; icon: ReactNode; title: string; desc: string; meta?: string; status?: { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string } }) {
  return (
    <button type="button" onClick={onClick} className="text-left w-full">
      <CCCard className="p-5 hover:border-[color:var(--cc-brand-600)]/40 transition-colors h-full cursor-pointer">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-[color:var(--cc-brand-600)]/10 text-[color:var(--cc-brand-600)] flex items-center justify-center shrink-0">{icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium truncate">{title}</div>
              {status && <CCStatusPill tone={status.tone} dot>{status.label}</CCStatusPill>}
            </div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</div>
            {meta && <div className="text-[11px] text-muted-foreground/80 mt-2 tabular-nums">{meta}</div>}
          </div>
        </div>
      </CCCard>
    </button>
  );
}

function SettingsPage() {
  const { atLeast, user, profile } = useAuth() as any;
  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Alex Morgan";
  const email = user?.email ?? "alex.morgan@contoso.com";
  const [open, setOpen] = useState<TileKey | null>(null);
  return (
    <>
      <PageHeader
        title="Settings"
        description="Personal preferences are available to everyone. Org-wide settings appear for Operations & Super Admins."
      />
      <div className="px-8 py-6 space-y-8">
        {/* Profile summary */}
        <CCCard className="p-5">
          <div className="flex flex-wrap items-center gap-5">
            <div className="size-14 rounded-full bg-[color:var(--cc-brand-600)] text-white flex items-center justify-center text-lg font-semibold">
              {displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-base">{displayName}</div>
              <div className="text-xs text-muted-foreground">{email} · Staff ID CC-0427 · Team: Retention West</div>
              <div className="mt-1 flex flex-wrap gap-2">
                <CCStatusPill tone="success" dot>Active</CCStatusPill>
                <CCStatusPill tone="info">Sr. Agent</CCStatusPill>
                <CCStatusPill tone="neutral">UTC+01:00 · London</CCStatusPill>
              </div>
            </div>
            <div className="ml-auto grid grid-cols-3 gap-6 text-center">
              <Stat label="Last sign-in" value="2h ago" />
              <Stat label="Devices" value="3" />
              <Stat label="Sessions" value="1 active" />
            </div>
          </div>
        </CCCard>

        <section>
          <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-3">Personal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Tile onClick={() => setOpen("notifications")} icon={<Bell className="size-5" />} title="Notification preferences" desc="Choose how you're alerted about new tasks, missed calls, and QA feedback." meta="Email · In-app · SMS off" status={{ tone: "success", label: "On" }} />
            <Tile onClick={() => setOpen("mfa")} icon={<ShieldCheck className="size-5" />} title="Two-factor authentication" desc="Add an authenticator app for an extra layer of sign-in security." meta="Authenticator app · backup codes generated" status={{ tone: "success", label: "Enabled" }} />
            <Tile onClick={() => setOpen("profile")} icon={<User className="size-5" />} title="Profile & avatar" desc="Update your display name, photo, and contact info shown to teammates." meta="Last edited 12 Jun" status={{ tone: "neutral", label: "Complete" }} />
            <Tile onClick={() => setOpen("appearance")} icon={<Palette className="size-5" />} title="Appearance" desc="Switch between light, dark, and system themes. Adjust density for the wallboard." meta="Theme: System · Density: Comfortable" status={{ tone: "info", label: "System" }} />
            <Tile onClick={() => setOpen("language")} icon={<Languages className="size-5" />} title="Language & region" desc="Pick the interface language, date format, and timezone for reports." meta="English (UK) · DD/MM/YYYY · Europe/London" />
            <Tile onClick={() => setOpen("audio")} icon={<Headphones className="size-5" />} title="Audio devices" desc="Choose the headset and mic used for calls. Run a quick echo test." meta="Jabra Evolve 65 · Mic level 78%" status={{ tone: "success", label: "Tested" }} />
          </div>
        </section>
        {atLeast("ops_admin") && (
          <section>
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-3">Organisation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Tile onClick={() => setOpen("staff")} icon={<Building2 className="size-5" />} title="Staff & teams" desc="Provision users, assign roles, and structure teams." meta="142 staff · 9 teams · 4 pending invites" status={{ tone: "warning", label: "4 invites" }} />
              <Tile onClick={() => setOpen("roles")} icon={<KeyRound className="size-5" />} title="Roles & access" desc="Manage system roles and custom organisation roles." meta="5 system roles · 3 custom roles" status={{ tone: "info", label: "8 roles" }} />
              <Tile onClick={() => setOpen("telephony")} icon={<Settings2 className="size-5" />} title="Telephony" desc="Connect Twilio, Vonage, or another carrier. Test credentials before going live." meta="Twilio (primary) · Vonage (failover)" status={{ tone: "success", label: "Connected" }} />
              <Tile onClick={() => setOpen("integrations")} icon={<Plug className="size-5" />} title="Integrations" desc="CRMs, ticketing, calendars, and webhooks." meta="6 active · Salesforce · Zendesk · Slack" status={{ tone: "success", label: "6 active" }} />
              <Tile onClick={() => setOpen("audit")} icon={<ScrollText className="size-5" />} title="Audit log" desc="Immutable record of every sensitive change." meta="1,284 events in last 7 days" status={{ tone: "neutral", label: "Healthy" }} />
              <Tile onClick={() => setOpen("compliance")} icon={<Globe className="size-5" />} title="Compliance & data" desc="GDPR/DSAR queue, retention windows, and contact-hour rules." meta="Region: EU · Retention: 365d · 2 open DSARs" status={{ tone: "warning", label: "2 open" }} />
            </div>
          </section>
        )}
        {atLeast("super_admin") && (
          <section>
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-3">Platform</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Tile onClick={() => setOpen("permissions")} icon={<Cog className="size-5" />} title="Permission matrix" desc="Fine-grained permission editor for every system & custom role." meta="74 permissions across 12 domains" status={{ tone: "info", label: "Up to date" }} />
            </div>
          </section>
        )}

        {/* Recent settings activity */}
        <CCWidget title="Recent settings activity" hint="Last changes made by you or admins to this workspace.">
          <ul className="divide-y divide-[color:var(--cc-ink-200)] text-sm">
            {RECENT_SETTINGS_ACTIVITY.map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <Clock className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate"><span className="font-medium">{a.actor}</span> · {a.action}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.detail}</div>
                </div>
                <CCStatusPill tone={a.tone as any}>{a.area}</CCStatusPill>
                <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">{a.when}</span>
              </li>
            ))}
          </ul>
        </CCWidget>
      </div>
      <SettingsDialog which={open} onOpenChange={(v) => !v && setOpen(null)} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

const RECENT_SETTINGS_ACTIVITY = [
  { actor: "You", action: "enabled two-factor authentication", detail: "Authenticator app · 10 backup codes generated", area: "Security", tone: "success", when: "2h ago" },
  { actor: "Priya Shah", action: "updated Twilio credentials", detail: "Primary trunk rotated · test call passed", area: "Telephony", tone: "info", when: "Yesterday" },
  { actor: "Marcus Webb", action: "invited 4 new agents", detail: "Retention West · role: Agent · expires in 6d", area: "Staff", tone: "warning", when: "2d ago" },
  { actor: "System", action: "rotated audit log signing key", detail: "Scheduled quarterly rotation · no action required", area: "Audit", tone: "neutral", when: "5d ago" },
  { actor: "Lena Ortiz", action: "added Zendesk integration", detail: "Ticket sync · bi-directional · 2 webhooks", area: "Integrations", tone: "success", when: "1w ago" },
  { actor: "You", action: "changed notification preferences", detail: "SMS disabled · in-app & email kept on", area: "Personal", tone: "neutral", when: "1w ago" },
];

type TileKey =
  | "notifications" | "mfa" | "profile" | "appearance" | "language" | "audio"
  | "staff" | "roles" | "telephony" | "integrations" | "audit" | "compliance"
  | "permissions";

const TILE_META: Record<TileKey, { title: string; desc: string; deepLink?: { to: string; label: string } }> = {
  notifications: { title: "Notification preferences", desc: "Pick the channels and events that reach you.", deepLink: { to: "/notifications", label: "Open notification centre" } },
  mfa: { title: "Two-factor authentication", desc: "Authenticator app and backup codes.", deepLink: { to: "/security/mfa", label: "Manage MFA" } },
  profile: { title: "Profile & avatar", desc: "How teammates see you across the platform." },
  appearance: { title: "Appearance", desc: "Theme, density, and wallboard contrast." },
  language: { title: "Language & region", desc: "Interface language, date format, and timezone." },
  audio: { title: "Audio devices", desc: "Headset, microphone, and echo test." },
  staff: { title: "Staff & teams", desc: "Provision users, assign roles, and structure teams.", deepLink: { to: "/staff", label: "Open staff directory" } },
  roles: { title: "Roles & access", desc: "System roles and custom organisation roles.", deepLink: { to: "/admin/roles", label: "Open roles manager" } },
  telephony: { title: "Telephony", desc: "Carrier credentials and failover.", deepLink: { to: "/telephony/settings", label: "Open telephony settings" } },
  integrations: { title: "Integrations", desc: "CRMs, ticketing, calendars, and webhooks.", deepLink: { to: "/integrations", label: "Open integrations" } },
  audit: { title: "Audit log", desc: "Immutable record of every sensitive change.", deepLink: { to: "/security/audit", label: "Open audit log" } },
  compliance: { title: "Compliance & data", desc: "GDPR/DSAR queue, retention, and contact-hour rules.", deepLink: { to: "/compliance", label: "Open compliance hub" } },
  permissions: { title: "Permission matrix", desc: "Fine-grained editor for every system & custom role.", deepLink: { to: "/admin/permissions", label: "Open permission matrix" } },
};

function SettingsDialog({ which, onOpenChange }: { which: TileKey | null; onOpenChange: (v: boolean) => void }) {
  const open = which !== null;
  const meta = which ? TILE_META[which] : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {meta && (
          <>
            <DialogHeader>
              <DialogTitle>{meta.title}</DialogTitle>
              <DialogDescription>{meta.desc}</DialogDescription>
            </DialogHeader>
            <div className="py-2">{which && renderBody(which)}</div>
            <DialogFooter className="gap-2 sm:gap-2">
              {meta.deepLink && (
                <Button asChild variant="outline" size="sm">
                  <Link to={meta.deepLink.to}>{meta.deepLink.label}</Link>
                </Button>
              )}
              <Button size="sm" onClick={() => { toast.success(`${meta.title} saved`); onOpenChange(false); }}>Save changes</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-[color:var(--cc-ink-200)] last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function renderBody(k: TileKey) {
  switch (k) {
    case "notifications":
      return (
        <div>
          <Row label="Email" hint="Digest at 08:00 UTC"><Switch defaultChecked /></Row>
          <Row label="In-app" hint="Toast + inbox badge"><Switch defaultChecked /></Row>
          <Row label="SMS" hint="Only P1 escalations"><Switch /></Row>
          <Row label="Missed calls" hint="Send instantly"><Switch defaultChecked /></Row>
          <Row label="QA feedback" hint="When a review is published"><Switch defaultChecked /></Row>
        </div>
      );
    case "mfa":
      return (
        <div>
          <Row label="Authenticator app" hint="Google Authenticator · Added 12 Jun"><CCStatusPill tone="success" dot>Enabled</CCStatusPill></Row>
          <Row label="Backup codes" hint="10 remaining · rotate every 90 days"><Button size="sm" variant="outline">Regenerate</Button></Row>
          <Row label="Trusted devices" hint="3 devices remembered"><Button size="sm" variant="outline">Review</Button></Row>
          <Row label="Require MFA on sign-in" hint="Enforced for your role"><Switch defaultChecked disabled /></Row>
        </div>
      );
    case "profile":
      return (
        <div className="space-y-3">
          <div><Label>Display name</Label><Input defaultValue="Alex Morgan" /></div>
          <div><Label>Job title</Label><Input defaultValue="Senior Retention Agent" /></div>
          <div><Label>Contact email</Label><Input defaultValue="alex.morgan@contoso.com" /></div>
          <div><Label>Phone (internal)</Label><Input defaultValue="+44 20 7946 0427" /></div>
        </div>
      );
    case "appearance":
      return (
        <div>
          <Row label="Theme" hint="Follows OS by default">
            <select className="h-8 rounded-md border px-2 text-sm bg-background"><option>System</option><option>Light</option><option>Dark</option></select>
          </Row>
          <Row label="Density" hint="Wallboard row height">
            <select className="h-8 rounded-md border px-2 text-sm bg-background"><option>Comfortable</option><option>Compact</option></select>
          </Row>
          <Row label="High contrast" hint="Improves wallboard readability"><Switch /></Row>
          <Row label="Reduce motion" hint="Disables non-essential animations"><Switch /></Row>
        </div>
      );
    case "language":
      return (
        <div>
          <Row label="Language">
            <select className="h-8 rounded-md border px-2 text-sm bg-background"><option>English (UK)</option><option>English (US)</option><option>Français</option><option>Deutsch</option><option>Español</option></select>
          </Row>
          <Row label="Date format">
            <select className="h-8 rounded-md border px-2 text-sm bg-background"><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select>
          </Row>
          <Row label="Timezone">
            <select className="h-8 rounded-md border px-2 text-sm bg-background"><option>Europe/London</option><option>Europe/Paris</option><option>America/New_York</option><option>Asia/Manila</option></select>
          </Row>
          <Row label="First day of week">
            <select className="h-8 rounded-md border px-2 text-sm bg-background"><option>Monday</option><option>Sunday</option></select>
          </Row>
        </div>
      );
    case "audio":
      return (
        <div>
          <Row label="Headset" hint="Jabra Evolve 65"><Button size="sm" variant="outline">Change</Button></Row>
          <Row label="Microphone" hint="Level 78%"><Button size="sm" variant="outline">Test</Button></Row>
          <Row label="Ringtone device" hint="Speakers"><Button size="sm" variant="outline">Change</Button></Row>
          <Row label="Noise suppression" hint="Krisp · low CPU mode"><Switch defaultChecked /></Row>
          <Row label="Echo cancellation"><Switch defaultChecked /></Row>
        </div>
      );
    case "staff":
      return (
        <div>
          <Row label="Total staff"><span className="text-sm tabular-nums">142</span></Row>
          <Row label="Teams"><span className="text-sm tabular-nums">9</span></Row>
          <Row label="Pending invites" hint="Expires in 7d"><CCStatusPill tone="warning" dot>4</CCStatusPill></Row>
          <Row label="Onboarding queue"><span className="text-sm tabular-nums">6</span></Row>
          <Row label="Auto-provision from HRIS" hint="BambooHR sync"><Switch defaultChecked /></Row>
        </div>
      );
    case "roles":
      return (
        <div>
          <Row label="System roles" hint="Agent · Team Lead · QA · Ops Admin · Super Admin"><span className="text-sm tabular-nums">5</span></Row>
          <Row label="Custom roles" hint="Complaints Officer, WFM Analyst, Trainer"><span className="text-sm tabular-nums">3</span></Row>
          <Row label="Role-review cadence"><select className="h-8 rounded-md border px-2 text-sm bg-background"><option>Quarterly</option><option>Monthly</option><option>Annually</option></select></Row>
          <Row label="Require approval to change role"><Switch defaultChecked /></Row>
        </div>
      );
    case "telephony":
      return (
        <div className="space-y-3">
          <Row label="Primary carrier" hint="Twilio · SIP trunk 1"><CCStatusPill tone="success" dot>Connected</CCStatusPill></Row>
          <Row label="Failover" hint="Vonage · warm standby"><CCStatusPill tone="info" dot>Ready</CCStatusPill></Row>
          <div><Label>Account SID</Label><Input defaultValue="AC••••••••••••••••••••••••7f21" /></div>
          <div><Label>Auth token</Label><Input type="password" defaultValue="••••••••••••••••" /></div>
          <Row label="Record all calls"><Switch defaultChecked /></Row>
        </div>
      );
    case "integrations":
      return (
        <div>
          <Row label="Salesforce" hint="Contact sync · bi-directional"><CCStatusPill tone="success" dot>Active</CCStatusPill></Row>
          <Row label="Zendesk" hint="Ticket handoff"><CCStatusPill tone="success" dot>Active</CCStatusPill></Row>
          <Row label="Slack" hint="Alerts to #cc-ops"><CCStatusPill tone="success" dot>Active</CCStatusPill></Row>
          <Row label="HubSpot" hint="Lead capture"><CCStatusPill tone="success" dot>Active</CCStatusPill></Row>
          <Row label="Google Calendar" hint="Callback scheduling"><CCStatusPill tone="success" dot>Active</CCStatusPill></Row>
          <Row label="Webhooks" hint="3 endpoints · last delivery 2m ago"><CCStatusPill tone="success" dot>Healthy</CCStatusPill></Row>
        </div>
      );
    case "audit":
      return (
        <div>
          <Row label="Events last 7 days"><span className="text-sm tabular-nums">1,284</span></Row>
          <Row label="Signing key rotation" hint="Quarterly"><CCStatusPill tone="neutral" dot>Healthy</CCStatusPill></Row>
          <Row label="Retention" hint="Cannot be shortened"><span className="text-sm tabular-nums">7 years</span></Row>
          <Row label="Export"><Button size="sm" variant="outline">Download CSV</Button></Row>
          <Row label="Realtime alerting" hint="Fires on privileged actions"><Switch defaultChecked /></Row>
        </div>
      );
    case "compliance":
      return (
        <div>
          <Row label="Jurisdiction"><select className="h-8 rounded-md border px-2 text-sm bg-background"><option>EU (GDPR)</option><option>UK (UK-GDPR)</option><option>US (CCPA)</option></select></Row>
          <Row label="Data retention" hint="Call recordings & transcripts"><select className="h-8 rounded-md border px-2 text-sm bg-background"><option>365 days</option><option>180 days</option><option>90 days</option></select></Row>
          <Row label="Open DSARs" hint="2 due this week"><CCStatusPill tone="warning" dot>2 open</CCStatusPill></Row>
          <Row label="Contact-hour window" hint="Local time"><span className="text-sm tabular-nums">08:00 – 20:00</span></Row>
          <Row label="Do-not-call sync" hint="Global list, refreshed daily"><Switch defaultChecked /></Row>
        </div>
      );
    case "permissions":
      return (
        <div>
          <Row label="Domains covered"><span className="text-sm tabular-nums">12</span></Row>
          <Row label="Permissions"><span className="text-sm tabular-nums">74</span></Row>
          <Row label="Roles using matrix"><span className="text-sm tabular-nums">8</span></Row>
          <Row label="Last review" hint="By Marcus Webb"><span className="text-xs text-muted-foreground">3 days ago</span></Row>
          <Row label="Require dual approval on grant"><Switch defaultChecked /></Row>
        </div>
      );
  }
}