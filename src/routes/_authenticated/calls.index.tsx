import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { DUMMY_CALLS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/calls/")({
  component: CallsList,
});

function CallsList() {
  const { data: realCalls = [] } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*, contacts(name), qa_reviews(overall_score)")
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const ids = Array.from(new Set(rows.map((r) => r.agent_id)));
      let profiles: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name ?? ""]));
      }
      return rows.map((r) => ({ ...r, agent_name: profiles[r.agent_id] ?? "—" }));
    },
  });

  const isSample = realCalls.length === 0;
  const calls: any[] = isSample ? DUMMY_CALLS : realCalls;

  return (
    <>
      <PageHeader
        title="Calls"
        description="Recent calls logged across the team."
        actions={
          <Button asChild>
            <Link to="/calls/new"><Plus className="size-4 mr-2" /> New call</Link>
          </Button>
        }
      />
      <div className="p-6">
        {isSample && (
          <div className="mb-3 text-xs text-muted-foreground">
            Showing sample data for preview. Log a call to see live entries.
          </div>
        )}
        <Card className="rounded-none border-0 shadow-none bg-transparent p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">QA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((c) => {
                const qa = Array.isArray(c.qa_reviews) ? c.qa_reviews[0] : c.qa_reviews;
                const score = qa?.overall_score;
                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-accent/30">
                    <TableCell>
                      {isSample ? (
                        <span>{new Date(c.started_at).toLocaleString()}</span>
                      ) : (
                        <Link to="/calls/$id" params={{ id: c.id }} className="hover:underline">
                          {new Date(c.started_at).toLocaleString()}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{c.contacts?.name ?? "—"}</TableCell>
                <TableCell>{c.agent_name}</TableCell>
                    <TableCell className="capitalize">{c.direction}</TableCell>
                    <TableCell className="capitalize">{c.outcome}</TableCell>
                    <TableCell className="text-right">
                      {score != null ? (
                        <Badge variant="secondary">{Math.round(Number(score))}%</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}