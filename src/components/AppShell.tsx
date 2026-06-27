import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Sparkles, UsersRound, PhoneCall, ClipboardCheck, LayoutDashboard, LogOut,
  SlidersHorizontal, UserRoundCog, ShieldCheck, ScrollText, ContactRound,
  AudioLines, Radio, Settings2, ListChecks, BookOpenText, Gauge, LineChart,
  Bell, AlertOctagon, CalendarClock, Megaphone, FileBarChart2, Plug, FileCheck2, KeyRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  agent: "Agent",
  team_leader: "Team Leader",
  supervisor: "Supervisor",
  ops_admin: "Operations Admin",
  super_admin: "Super Admin",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, isManager, atLeast, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Highest-ranked role label (e.g. shows "Super Admin", not "Agent")
  const ROLE_RANK = ["super_admin", "ops_admin", "supervisor", "team_leader", "agent"];
  const topRole = ROLE_RANK.find((r) => roles.includes(r as any)) ?? "agent";

  // Grouped, playful icon set — rounded lucide variants + section labels for
  // a clearer information hierarchy than one long flat list.
  const sections: { label: string; items: { to: string; label: string; icon: typeof PhoneCall; show: boolean }[] }[] = [
    {
      label: "Workspace",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
        { to: "/tasks", label: "Tasks", icon: ListChecks, show: true },
        { to: "/announcements", label: "Announcements", icon: Megaphone, show: true },
        { to: "/attendance", label: "Attendance", icon: CalendarClock, show: true },
      ],
    },
    {
      label: "Calling",
      items: [
        { to: "/calls", label: "Calls", icon: PhoneCall, show: true },
        { to: "/recordings", label: "Recordings", icon: AudioLines, show: true },
        { to: "/monitoring", label: "Live floor", icon: Radio, show: atLeast("team_leader") },
        { to: "/scripts", label: "Scripts", icon: BookOpenText, show: true },
      ],
    },
    {
      label: "People",
      items: [
        { to: "/clients", label: "Clients", icon: ContactRound, show: true },
        { to: "/contacts", label: "Contacts", icon: UsersRound, show: true },
        { to: "/complaints", label: "Complaints", icon: AlertOctagon, show: true },
      ],
    },
    {
      label: "Quality",
      items: [
        { to: "/qa/reviews", label: "QA reviews", icon: ClipboardCheck, show: true },
        { to: "/qa/scorecards", label: "Scorecards", icon: Gauge, show: atLeast("supervisor") },
        { to: "/qa/dashboard", label: "QA trends", icon: LineChart, show: isManager },
        { to: "/qa/criteria", label: "Legacy criteria", icon: SlidersHorizontal, show: isManager },
      ],
    },
    {
      label: "Administration",
      items: [
        { to: "/reports", label: "Reports", icon: FileBarChart2, show: atLeast("team_leader") },
        { to: "/compliance", label: "Compliance", icon: FileCheck2, show: atLeast("team_leader") },
        { to: "/integrations", label: "Integrations", icon: Plug, show: atLeast("supervisor") },
        { to: "/staff", label: "Staff", icon: UserRoundCog, show: atLeast("ops_admin") },
        { to: "/telephony/settings", label: "Telephony", icon: Settings2, show: atLeast("ops_admin") },
        { to: "/security/audit", label: "Audit log", icon: ScrollText, show: atLeast("ops_admin") },
        { to: "/admin/roles", label: "Roles & access", icon: KeyRound, show: atLeast("ops_admin") },
        { to: "/admin/permissions", label: "Permissions", icon: ShieldCheck, show: atLeast("super_admin") },
      ],
    },
  ].map((s) => ({ ...s, items: s.items.filter((i) => i.show) })).filter((s) => s.items.length > 0);

  return (
    <div className="min-h-screen flex bg-muted/20">
      <aside className="w-64 border-r bg-background hidden md:flex flex-col">
        <div className="h-16 flex items-center gap-3 px-5 border-b">
          <div className="size-9 rounded-xl bg-gradient-to-br from-[color:var(--cc-brand-600)] to-[color:var(--cc-brand)] text-white flex items-center justify-center shadow-sm">
            <Sparkles className="size-[18px]" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-none tracking-tight">Call Centre</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Operations</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {sections.map((section) => (
            <div key={section.label} className="space-y-1">
              <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((n) => {
                  const active = pathname === n.to || pathname.startsWith(n.to + "/");
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-[color:var(--cc-brand-600)]/10 text-[color:var(--cc-brand-700,var(--cc-brand-600))] font-medium"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn("size-[18px] shrink-0 transition-colors", active ? "text-[color:var(--cc-brand-600)]" : "text-muted-foreground group-hover:text-foreground")}
                        strokeWidth={active ? 2.25 : 1.85}
                      />
                      <span className="truncate">{n.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t space-y-3">
          <div className="space-y-1">
            <div className="text-xs font-medium text-foreground truncate">{user?.email}</div>
            <span className="inline-flex items-center rounded-full bg-[color:var(--cc-brand-600)]/10 text-[color:var(--cc-brand-700,var(--cc-brand-600))] px-2 py-0.5 text-[11px] font-medium">
              {ROLE_LABEL[topRole] ?? "Agent"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center"
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <NotificationsBell />
        {children}
      </main>
    </div>
  );
}

function NotificationsBell() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("notifications" as any)
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
        .eq("user_id", user.id);
      if (!cancelled) setUnread(count ?? 0);
    };
    load();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        load,
      ).subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user?.id]);

  return (
    <Link
      to="/notifications"
      aria-label={`Notifications (${unread} unread)`}
      className="fixed top-4 right-6 z-40 inline-flex items-center justify-center size-10 rounded-full bg-background border shadow-sm hover:bg-accent transition-colors"
    >
      <Bell className="size-[18px]" strokeWidth={2} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--cc-danger)] text-white text-[10px] font-semibold flex items-center justify-center">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="border-b bg-background px-8 py-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-[22px] font-semibold tracking-tight leading-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 justify-end">{actions}</div>}
    </div>
  );
}