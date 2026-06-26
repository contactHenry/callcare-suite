import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { DUMMY_CONTACTS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/contacts/")({
  component: ContactsList,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  lead: "secondary",
  customer: "default",
  churned: "outline",
};

function ContactsList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data: realContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isSample = realContacts.length === 0;
  const contacts: any[] = isSample ? DUMMY_CONTACTS : realContacts;

  const filtered = contacts.filter((c) => {
    const s = q.toLowerCase();
    return !s || [c.name, c.company, c.email, c.phone].some((v) => v?.toLowerCase().includes(s));
  });

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Your CRM of leads and customers."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-2" /> New contact</Button>
            </DialogTrigger>
            <DialogContent>
              <ContactForm
                onSaved={() => {
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["contacts"] });
                }}
                ownerId={user?.id ?? ""}
              />
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-6 space-y-4">
        {isSample && (
          <div className="text-xs text-muted-foreground">
            Showing sample data for preview. Add a contact to see live entries.
          </div>
        )}
        <div className="relative max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts…" className="pl-9" />
        </div>
        <Card className="rounded-none border-0 shadow-none bg-transparent p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-accent/30">
                  <TableCell>
                    {isSample ? (
                      <span className="font-medium">{c.name}</span>
                    ) : (
                      <Link to="/contacts/$id" params={{ id: c.id }} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    )}
                    {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                  </TableCell>
                  <TableCell>{c.company ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"} className="capitalize">{c.status}</Badge>
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

function ContactForm({ ownerId, onSaved }: { ownerId: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: "", company: "", phone: "", email: "", status: "lead", notes: "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <>
      <DialogHeader><DialogTitle>New contact</DialogTitle></DialogHeader>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await supabase.from("contacts").insert({ ...form, owner_id: ownerId });
          setBusy(false);
          if (error) return toast.error(error.message);
          toast.success("Contact created");
          onSaved();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Name *</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="churned">Churned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save contact"}</Button>
        </DialogFooter>
      </form>
    </>
  );
}