import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calls/")({
  component: CallsList,
});

function CallsList() {
  const { data: calls = [] } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*, contacts(name), profiles!calls_agent_id_fkey(full_name), qa_reviews(overall_score)")
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

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
        <Card>
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
              {calls.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">No calls yet.</TableCell></TableRow>
              )}
              {calls.map((c) => {
                const score = c.qa_reviews?.[0]?.overall_score;
                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-accent/30">
                    <TableCell>
                      <Link to="/calls/$id" params={{ id: c.id }} className="hover:underline">
                        {new Date(c.started_at).toLocaleString()}
                      </Link>
                    </TableCell>
                    <TableCell>{c.contacts?.name ?? "—"}</TableCell>
                    <TableCell>{c.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{c.direction}</TableCell>
                    <TableCell className="capitalize">{c.outcome}</TableCell>
                    <TableCell className="text-right">
                      {score != null ? <Badge variant="secondary">{Math.round(Number(score))}%</Badge> : <span className="text-xs text-muted-foreground">Pending</span>}
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