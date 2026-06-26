import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Headset, Users, Phone, ClipboardCheck, BarChart3, LogOut, Sliders } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isManager, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { to: "/calls", label: "Calls", icon: Phone },
    { to: "/contacts", label: "Contacts", icon: Users },
    { to: "/qa/dashboard", label: "QA Scores", icon: ClipboardCheck },
    ...(isManager ? [{ to: "/qa/criteria", label: "Scorecard", icon: Sliders }] : []),
  ];

  return (
    <div className="min-h-screen flex bg-muted/20">
      <aside className="w-60 border-r bg-background hidden md:flex flex-col">
        <div className="h-14 flex items-center gap-2 px-4 border-b">
          <div className="size-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Headset className="size-4" />
          </div>
          <span className="font-semibold">Call Centre</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                  active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                <Icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-2">
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          <div className="text-xs">
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5">
              {isManager ? "Manager" : "Agent"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="border-b bg-background px-6 py-4 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}