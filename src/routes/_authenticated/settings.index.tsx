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