import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { CCButton } from "@/components/cc";
import { CalendarCheck2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/follow-ups/")({
  head: () => ({ meta: [{ title: "Follow-Ups" }] }),
  component: FollowUpsPage,
});

function FollowUpsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Follow-Ups"
        description="Scheduled callbacks and outreach owed to clients. Backed by the Tasks module with a follow-up filter applied."
        actions={<Link to="/tasks"><CCButton size="sm">Open in Tasks</CCButton></Link>}
      />
      <div className="px-8 py-12">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <div className="size-14 rounded-2xl bg-[color:var(--cc-brand-600)]/10 text-[color:var(--cc-brand-600)] mx-auto flex items-center justify-center">
            <CalendarCheck2 className="size-7" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Your follow-ups live alongside tasks</h2>
          <p className="text-sm text-muted-foreground">
            Every call disposition that requires a callback creates a task tagged
            <span className="mx-1 inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium">follow-up</span>
            so a single queue tracks what's owed back to each client.
          </p>
          <Link to="/tasks"><CCButton>Go to follow-up queue</CCButton></Link>
        </div>
      </div>
    </AppShell>
  );
}