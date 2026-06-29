import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { CCCard } from "@/components/cc";
import { useAuth } from "@/lib/auth";
import { Bell, ShieldCheck, Cog, KeyRound, Plug, Settings2, Building2, ScrollText } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: SettingsPage,
});

function Tile({ to, icon, title, desc }: { to: string; icon: ReactNode; title: string; desc: string }) {
  return (
    <Link to={to}>
      <CCCard className="p-5 hover:border-[color:var(--cc-brand-600)]/40 transition-colors h-full">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-[color:var(--cc-brand-600)]/10 text-[color:var(--cc-brand-600)] flex items-center justify-center shrink-0">{icon}</div>
          <div className="min-w-0">
            <div className="font-medium">{title}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</div>
          </div>
        </div>
      </CCCard>
    </Link>
  );
}

function SettingsPage() {
  const { atLeast } = useAuth();
  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="Personal preferences are available to everyone. Org-wide settings appear for Operations & Super Admins."
      />
      <div className="px-8 py-6 space-y-8">
        <section>
          <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-3">Personal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Tile to="/notifications" icon={<Bell className="size-5" />} title="Notification preferences" desc="Choose how you're alerted about new tasks, missed calls, and QA feedback." />
            <Tile to="/security/mfa" icon={<ShieldCheck className="size-5" />} title="Two-factor authentication" desc="Add an authenticator app for an extra layer of sign-in security." />
          </div>
        </section>
        {atLeast("ops_admin") && (
          <section>
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-3">Organisation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Tile to="/staff" icon={<Building2 className="size-5" />} title="Staff & teams" desc="Provision users, assign roles, and structure teams." />
              <Tile to="/admin/roles" icon={<KeyRound className="size-5" />} title="Roles & access" desc="Manage system roles and custom organisation roles." />
              <Tile to="/telephony/settings" icon={<Settings2 className="size-5" />} title="Telephony" desc="Connect Twilio, Vonage, or another carrier. Test credentials before going live." />
              <Tile to="/integrations" icon={<Plug className="size-5" />} title="Integrations" desc="CRMs, ticketing, calendars, and webhooks." />
              <Tile to="/security/audit" icon={<ScrollText className="size-5" />} title="Audit log" desc="Immutable record of every sensitive change." />
            </div>
          </section>
        )}
        {atLeast("super_admin") && (
          <section>
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-3">Platform</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Tile to="/admin/permissions" icon={<Cog className="size-5" />} title="Permission matrix" desc="Fine-grained permission editor for every system & custom role." />
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}