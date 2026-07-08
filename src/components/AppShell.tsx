import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sparkles, UsersRound, PhoneCall, ClipboardCheck, LayoutDashboard, LogOut,
  UserRoundCog, ShieldCheck, ScrollText, ContactRound,
  AudioLines, Radio, Settings2, ListChecks, BookOpenText, Gauge, LineChart,
  Bell, AlertOctagon, FileBarChart2, Plug, KeyRound, ShieldAlert,
  Users as UsersIcon, Target, CalendarCheck2, Cog, ChevronDown,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAvailability, PRESENCE_LABEL, PRESENCE_COLOR, type Presence } from "@/hooks/use-availability";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { PersistentCallBar } from "@/components/PersistentCallBar";

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
  const canTeamLead = atLeast("team_leader");
  const canSupervisor = atLeast("supervisor");
  const canOpsAdmin = atLeast("ops_admin");
  const canSuperAdmin = atLeast("super_admin");

  // Highest-ranked role label (e.g. shows "Super Admin", not "Agent")
  const ROLE_RANK = ["super_admin", "ops_admin", "supervisor", "team_leader", "agent"];
  const topRole = ROLE_RANK.find((r) => roles.includes(r as any)) ?? "agent";
  void isManager;

  // PRD Section 21 navigation — exact item order, grouped into four logical
  // sections. Items the current role cannot access are hidden (not disabled)
  // so we never advertise functionality a role shouldn't know exists.
  const sections: {
    label: string;
    items: { to: string; label: string; icon: typeof PhoneCall; show: boolean }[];
  }[] = useMemo(() => [
      {
        label: "Operations",
        items: [
          { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
          { to: "/clients", label: "Clients", icon: ContactRound, show: true },
          { to: "/calls", label: "Calls", icon: PhoneCall, show: true },
          { to: "/live-calls", label: "Live Calls", icon: Radio, show: canTeamLead },
          { to: "/recordings", label: "Call Recordings", icon: AudioLines, show: canTeamLead },
          { to: "/follow-ups", label: "Follow-Ups", icon: CalendarCheck2, show: true },
          { to: "/tasks", label: "Tasks", icon: ListChecks, show: true },
          { to: "/campaigns", label: "Campaigns", icon: Target, show: canSupervisor },
          { to: "/scripts", label: "Call Scripts", icon: BookOpenText, show: true },
        ],
      },
      {
        label: "People",
        items: [
          { to: "/teams", label: "Teams", icon: UsersIcon, show: canTeamLead },
          { to: "/staff", label: "Staff", icon: UserRoundCog, show: canOpsAdmin },
          { to: "/qa/reviews", label: "Quality Assurance", icon: ClipboardCheck, show: canTeamLead },
          { to: "/complaints", label: "Complaints", icon: AlertOctagon, show: true },
        ],
      },
      {
        label: "Insights",
        items: [
          { to: "/reports", label: "Reports", icon: FileBarChart2, show: true },
          { to: "/notifications", label: "Notifications", icon: Bell, show: true },
        ],
      },
      {
        label: "Compliance & Audit",
        items: [
          { to: "/compliance", label: "Compliance", icon: ShieldAlert, show: canOpsAdmin },
          { to: "/security/audit", label: "Audit Logs", icon: ScrollText, show: canOpsAdmin },
          { to: "/integrations", label: "Integrations", icon: Plug, show: canOpsAdmin },
        ],
      },
      {
        label: "Admin",
        items: [
          { to: "/admin/roles", label: "Roles & Access", icon: ShieldCheck, show: canOpsAdmin },
          { to: "/admin/permissions", label: "Permission Matrix", icon: KeyRound, show: canSuperAdmin },
          { to: "/settings", label: "Settings", icon: Cog, show: true },
        ],
      },
    ].map((s) => ({ ...s, items: s.items.filter((i) => i.show) })).filter((s) => s.items.length > 0), [canTeamLead, canSupervisor, canOpsAdmin, canSuperAdmin]);
  // Keep references to icons used elsewhere in the module so tree-shakers don't
  // complain in dev builds. (No runtime cost.)
  void UsersRound; void Settings2; void Gauge; void LineChart; void ShieldCheck; void KeyRound;

  return (
    <div className="min-h-screen flex bg-muted/20">
      {/* Sidebar — full labels at lg+, icon-only rail at md, hidden on mobile. */}
      <aside className="border-r bg-background hidden md:flex flex-col md:w-16 lg:w-64 transition-[width]">
        <div className="h-16 flex items-center gap-3 px-5 border-b">
          <div className="size-9 rounded-xl bg-gradient-to-br from-[color:var(--cc-brand-600)] to-[color:var(--cc-brand)] text-white flex items-center justify-center shadow-sm">
            <Sparkles className="size-[18px]" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 hidden lg:block">
            <div className="text-sm font-semibold leading-none tracking-tight">Call Centre</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Operations</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto cc-scrollbar px-3 py-4 space-y-5">
          {sections.map((section) => (
            <div key={section.label} className="space-y-1">
              <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 hidden lg:block">
                {section.label}
              </div>
              <div className="lg:hidden h-px bg-border mx-2" aria-hidden />
              <div className="space-y-0.5">
                {section.items.map((n) => {
                  const active = pathname === n.to || pathname.startsWith(n.to + "/");
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      preload={false}
                      title={n.label}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors justify-center lg:justify-start",
                        active
                          ? "bg-[color:var(--cc-brand-600)]/10 text-[color:var(--cc-brand-700,var(--cc-brand-600))] font-medium"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn("size-[18px] shrink-0 transition-colors", active ? "text-[color:var(--cc-brand-600)]" : "text-muted-foreground group-hover:text-foreground")}
                        strokeWidth={active ? 2.25 : 1.85}
                      />
                      <span className="truncate hidden lg:inline">{n.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <ProfileFooter
          email={user?.email ?? ""}
          userId={user?.id}
          roleLabel={ROLE_LABEL[topRole] ?? "Agent"}
          onSignOut={async () => { await signOut(); navigate({ to: "/auth" }); }}
        />
      </aside>
      <main className="flex-1 min-w-0">
        <NotificationsBell />
        {children}
      </main>
      <PersistentCallBar />
    </div>
  );
}

function ProfileFooter({ email, userId, roleLabel, onSignOut }: {
  email: string; userId: string | undefined; roleLabel: string; onSignOut: () => void;
}) {
  const { status, update } = useAvailability(userId);
  const options: Presence[] = ["available", "on_call", "acw", "break", "training", "meeting", "offline"];
  const [signOutOpen, setSignOutOpen] = useState(false);
  return (
    <div className="p-3 border-t space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-2 rounded-lg p-2 hover:bg-accent/60 transition-colors text-left">
            <span className="relative inline-flex">
              <span className={cn("size-8 rounded-full bg-gradient-to-br from-[color:var(--cc-brand-600)] to-[color:var(--cc-brand)] text-white text-xs font-semibold flex items-center justify-center")}>
                {(email?.[0] ?? "?").toUpperCase()}
              </span>
              <span className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-background", PRESENCE_COLOR[status])} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 hidden lg:block">
              <div className="text-xs font-medium truncate">{email}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", PRESENCE_COLOR[status])} aria-hidden />
                <span className="truncate">{PRESENCE_LABEL[status]}</span>
              </div>
            </div>
            <ChevronDown className="size-3.5 text-muted-foreground shrink-0 hidden lg:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Availability</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{roleLabel}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((o) => (
            <DropdownMenuItem key={o} onSelect={() => update(o)} className="gap-2">
              <span className={cn("size-2 rounded-full", PRESENCE_COLOR[o])} aria-hidden />
              <span>{PRESENCE_LABEL[o]}</span>
              {o === status && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSignOutOpen(true)} className="gap-2 text-rose-600 focus:text-rose-700">
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center lg:hidden"
        onClick={() => setSignOutOpen(true)}
        aria-label="Sign out"
      >
        <LogOut className="size-4" />
      </Button>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of Call Centre Operations?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSignOutOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onSignOut} className="bg-rose-600 hover:bg-rose-700">
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      try {
        const { count } = await supabase
          .from("notifications" as any)
          .select("id", { count: "exact", head: true })
          .is("read_at", null)
          .eq("user_id", user.id);
        if (!cancelled) setUnread(count ?? 0);
      } catch {
        /* notifications table may not exist yet — ignore */
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <Link
      to="/notifications"
      preload={false}
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