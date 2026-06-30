import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DUMMY_QA_CRITERIA } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/qa/criteria")({
  component: Criteria,
});

function Criteria() {
  const qc = useQueryClient();
  const { data: criteriaRaw = [] } = useQuery({
    queryKey: ["criteria-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("qa_criteria").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const criteria: any[] = (criteriaRaw && criteriaRaw.length > 0) ? (criteriaRaw as any[]) : DUMMY_QA_CRITERIA;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", description: "", weight: 1 });

  return (
    <>
      <PageHeader
        title="Scorecard criteria"
        description="Define the criteria managers use to score every call."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-2" /> New criterion</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New criterion</DialogTitle></DialogHeader>
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const { error } = await supabase.from("qa_criteria").insert(form);
                  if (error) return toast.error(error.message);
                  setForm({ label: "", description: "", weight: 1 });
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["criteria-all"] });
                }}
              >
                <div className="space-y-1.5">
                  <Label>Label</Label>
                  <Input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Weight</Label>
                  <Input type="number" step={0.5} min={0.5} value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-6">
        <Card className="rounded-none border-0 shadow-none bg-transparent p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {criteria.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.label}</TableCell>
                  <TableCell className="text-muted-foreground">{c.description ?? "—"}</TableCell>
                  <TableCell>{Number(c.weight)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={c.active}
                      onCheckedChange={async (v) => {
                        await supabase.from("qa_criteria").update({ active: v }).eq("id", c.id);
                        qc.invalidateQueries({ queryKey: ["criteria-all"] });
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm(`Delete "${c.label}"?`)) return;
                        const { error } = await supabase.from("qa_criteria").delete().eq("id", c.id);
                        if (error) return toast.error(error.message);
                        qc.invalidateQueries({ queryKey: ["criteria-all"] });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}