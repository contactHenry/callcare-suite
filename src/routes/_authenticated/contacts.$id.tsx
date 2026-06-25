import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contacts/$id")({
  component: ContactDetail,
});

function ContactDetail() {
  const { id } = Route.useParams();

  const { data: contact } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: calls = [] } = useQuery({
    queryKey: ["contact-calls", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*, qa_reviews(overall_score)")
        .eq("contact_id", id)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <>
      <PageHeader
        title={contact?.name ?? "Contact"}
        description={contact?.company ?? ""}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/contacts"><ArrowLeft className="size-4 mr-2" /> All contacts</Link>
            </Button>
            <Button asChild>
              <Link to="/calls/new" search={{ contactId: id }}>
                <Plus className="size-4 mr-2" /> Log call
              </Link>
            </Button>
          </>
        }
      />
      <div className="p-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Status" value={contact?.status && <Badge variant="secondary">{contact.status}</Badge>} />
            <Field label="Email" value={contact?.email ?? "—"} />
            <Field label="Phone" value={contact?.phone ?? "—"} />
            <Field label="Notes" value={contact?.notes ?? "—"} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Call history</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {calls.length === 0 && <p className="text-sm text-muted-foreground">No calls logged yet.</p>}
            {calls.map((c) => {
              const score = c.qa_reviews?.[0]?.overall_score;
              return (
                <Link
                  key={c.id}
                  to="/calls/$id"
                  params={{ id: c.id }}
                  className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/30"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium capitalize">{c.direction} — {c.outcome}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(c.started_at).toLocaleString()} · {Math.round(c.duration_seconds / 60)} min
                      </div>
                    </div>
                  </div>
                  {score != null && (
                    <Badge variant="secondary">{Math.round(Number(score))}%</Badge>
                  )}
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}