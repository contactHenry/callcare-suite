import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
import { Plus, Search, Phone, PhoneOff, Mic, MicOff, Volume2, Pause, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { DUMMY_CONTACTS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/contacts/")({
  component: ContactsList,
});

const STATUS_CLASS: Record<string, string> = {
  customer: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100",
  lead: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100",
  churned: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100",
};

function ContactsList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<any | null>(null);

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
        <div className={activeContact ? "grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6" : ""}>
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
                <TableRow
                  key={c.id}
                  onClick={() => c.phone && setActiveContact(c)}
                  data-active={activeContact?.id === c.id}
                  className="cursor-pointer hover:bg-accent/30 data-[active=true]:bg-accent/40"
                >
                  <TableCell>
                    <span className="font-medium">{c.name}</span>
                    {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                  </TableCell>
                  <TableCell>{c.company ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${STATUS_CLASS[c.status] ?? ""}`}>{c.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
          {activeContact && (
            <DialerPanel contact={activeContact} onClose={() => setActiveContact(null)} />
          )}
        </div>
      </div>
    </>
  );
}

function DialerPanel({ contact, onClose }: { contact: any; onClose: () => void }) {
  const [status, setStatus] = useState<"dialing" | "in-call" | "ended">("dialing");
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const idRef = useRef(contact.id);

  useEffect(() => {
    idRef.current = contact.id;
    setStatus("dialing");
    setMuted(false);
    setOnHold(false);
    setSeconds(0);
    const t = setTimeout(() => setStatus("in-call"), 2200);
    return () => clearTimeout(t);
  }, [contact.id]);

  useEffect(() => {
    if (status !== "in-call") return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [status]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const initials = (contact.name ?? "?")
    .split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Card className="rounded-xl border bg-card p-6 flex flex-col items-center text-center h-fit sticky top-6">
      <div className="w-full flex justify-end -mt-2 -mr-2">
        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="size-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-semibold mb-4">
        {initials}
      </div>
      <div className="text-lg font-semibold">{contact.name}</div>
      {contact.company && <div className="text-sm text-muted-foreground">{contact.company}</div>}
      <div className="text-base mt-2">{contact.phone}</div>
      <div className="mt-3 text-sm text-muted-foreground">
        {status === "dialing" && (
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-yellow-500 animate-pulse" /> Dialing…
          </span>
        )}
        {status === "in-call" && (
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-green-500" /> In call · {mm}:{ss}
          </span>
        )}
        {status === "ended" && (
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-500" /> Call ended
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6 w-full">
        <DialerBtn
          icon={muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          label={muted ? "Unmute" : "Mute"}
          active={muted}
          disabled={status === "ended"}
          onClick={() => setMuted((m) => !m)}
        />
        <DialerBtn
          icon={<Pause className="size-5" />}
          label={onHold ? "Resume" : "Hold"}
          active={onHold}
          disabled={status === "ended"}
          onClick={() => setOnHold((h) => !h)}
        />
        <DialerBtn
          icon={<Volume2 className="size-5" />}
          label="Speaker"
          disabled={status === "ended"}
          onClick={() => {}}
        />
      </div>

      <div className="mt-6 w-full">
        {status !== "ended" ? (
          <Button
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            onClick={() => setStatus("ended")}
          >
            <PhoneOff className="size-4 mr-2" /> End call
          </Button>
        ) : (
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={() => { setStatus("dialing"); setSeconds(0); setTimeout(() => idRef.current === contact.id && setStatus("in-call"), 2000); }}
          >
            <Phone className="size-4 mr-2" /> Call again
          </Button>
        )}
      </div>
    </Card>
  );
}

function DialerBtn({
  icon, label, onClick, active, disabled,
}: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-lg border py-3 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
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