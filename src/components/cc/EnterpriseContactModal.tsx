import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitEnterpriseEnquiry } from "@/lib/billing/subscription.functions";

const SIZES = ["1–10", "11–50", "51–200", "201–500", "501–1000", "1000+"];

export interface EnterpriseContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  defaultEmail?: string;
}

export function EnterpriseContactModal({
  open,
  onOpenChange,
  defaultName = "",
  defaultEmail = "",
}: EnterpriseContactModalProps) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [size, setSize] = useState(SIZES[1]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitFn = useServerFn(submitEnterpriseEnquiry);
  const mutation = useMutation({
    mutationFn: () =>
      submitFn({ data: { name, email, companySize: size, message } }),
    onSuccess: () => {
      onOpenChange(false);
      toast.success("Thanks — our team will be in touch within one business day.");
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!mutation.isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Talk to sales about Enterprise</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ent-name">Name</Label>
            <Input id="ent-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ent-email">Work email</Label>
            <Input id="ent-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Company size</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => <SelectItem key={s} value={s}>{s} people</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ent-msg">What are you looking to solve?</Label>
            <Textarea id="ent-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => { setError(null); mutation.mutate(); }}
            disabled={mutation.isPending || !name.trim() || !email.trim()}
            className="bg-[color:var(--cc-brand-600)] hover:bg-[color:var(--cc-brand-700)] text-white"
          >
            {mutation.isPending ? (<><Loader2 className="mr-2 size-4 animate-spin" /> Sending…</>) : "Send enquiry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}