/**
 * In-call control bar — the most-used UI surface in the app.
 * Built for clarity over density: big targets, unmistakable colors,
 * keyboard shortcuts, and live status. Used inline anywhere a call
 * is active (client profile, contact dialer, inbound popup).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic, MicOff, Pause, Play, PhoneOff, PhoneForwarded,
  Voicemail, Users as UsersIcon, AlertTriangle, Disc, Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  endCall, setCallMute, setCallHold, transferCall, dropVoicemail,
} from "@/lib/calls.functions";

export type CallSession = {
  callId: string;
  toNumber?: string | null;
  fromNumber?: string | null;
  contactName?: string | null;
  startedAt: string;
  direction: "inbound" | "outbound";
  recording: boolean;
  consentNotice?: string | null;
  voicemailDropEnabled?: boolean;
};

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

export function CallControlBar({
  session, onEnded, className,
}: {
  session: CallSession;
  onEnded?: () => void;
  className?: string;
}) {
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [session.startedAt]);

  // Keyboard shortcuts: M mute, H hold, E end
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt?.tagName === "INPUT" || tgt?.tagName === "TEXTAREA") return;
      if (e.key === "m" || e.key === "M") toggleMute();
      if (e.key === "h" || e.key === "H") toggleHold();
      if (e.key === "e" || e.key === "E") end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, held, busy]);

  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    try { await setCallMute({ data: { callId: session.callId, muted: next } }); }
    catch { setMuted(!next); toast.error("Mute failed"); }
  }
  async function toggleHold() {
    const next = !held;
    setHeld(next);
    try { await setCallHold({ data: { callId: session.callId, onHold: next } }); }
    catch { setHeld(!next); toast.error("Hold failed"); }
  }
  async function end() {
    if (busy) return;
    setBusy(true);
    try {
      await endCall({ data: { callId: session.callId } });
      toast.success("Call ended");
      onEnded?.();
    } catch (e: any) { toast.error(e?.message ?? "Could not end call"); }
    finally { setBusy(false); }
  }
  async function coldTransfer() {
    const to = window.prompt("Transfer to number (E.164, e.g. +15551234567)");
    if (!to) return;
    try {
      await transferCall({ data: { callId: session.callId, toNumber: to, kind: "cold" } });
      toast.success("Transferred");
    } catch (e: any) { toast.error(e?.message ?? "Transfer failed"); }
  }
  async function voicemail() {
    if (!session.voicemailDropEnabled) {
      toast.error("Voicemail drop is disabled in telephony settings");
      return;
    }
    const ok = window.confirm(
      "Legal: voicemail drop may be restricted in your jurisdiction.\n" +
      "By continuing you confirm this contact has not opted out and " +
      "drops are permitted under local law. Continue?",
    );
    if (!ok) return;
    try {
      await dropVoicemail({ data: { callId: session.callId, audioKey: "default", legalAck: true } });
      toast.success("Voicemail dropped");
    } catch (e: any) { toast.error(e?.message ?? "Voicemail drop failed"); }
  }

  const partyLabel = session.direction === "outbound" ? session.toNumber : session.fromNumber;

  return (
    <div className={cn(
      "rounded-xl border bg-card shadow-sm overflow-hidden",
      held ? "ring-2 ring-amber-300" : "",
      className,
    )}>
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-primary/5 to-transparent border-b">
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
            session.direction === "outbound" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800",
          )}>
            <Phone className="size-3" />
            {session.direction === "outbound" ? "Outbound" : "Inbound"}
          </span>
          {session.recording && (
            <span className="inline-flex items-center gap-1 text-xs text-red-700 font-medium">
              <Disc className="size-3 animate-pulse" /> REC
            </span>
          )}
          {held && <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">On hold</Badge>}
        </div>
        <div className="font-mono text-sm tabular-nums">{fmt(elapsed)}</div>
      </div>

      {/* Identity */}
      <div className="px-4 pt-3 pb-2">
        <div className="text-base font-semibold leading-tight truncate">
          {session.contactName ?? "Unknown caller"}
        </div>
        <div className="text-sm text-muted-foreground font-mono truncate">{partyLabel ?? "—"}</div>
        {session.consentNotice && (
          <div className="mt-2 text-[11px] text-muted-foreground bg-muted/50 px-2 py-1 rounded border">
            <AlertTriangle className="inline size-3 mr-1 text-amber-600" />
            {session.consentNotice}
          </div>
        )}
      </div>

      {/* Controls — big, color-coded, keyboard-shortcutted */}
      <div className="px-3 pb-3 grid grid-cols-5 gap-2">
        <ControlBtn label={muted ? "Unmute" : "Mute"} hotkey="M" active={muted}
          onClick={toggleMute}
          icon={muted ? <MicOff className="size-5" /> : <Mic className="size-5" />} />
        <ControlBtn label={held ? "Resume" : "Hold"} hotkey="H" active={held}
          onClick={toggleHold}
          icon={held ? <Play className="size-5" /> : <Pause className="size-5" />} />
        <ControlBtn label="Transfer" onClick={coldTransfer}
          icon={<PhoneForwarded className="size-5" />} />
        <ControlBtn label="Voicemail" onClick={voicemail}
          icon={<Voicemail className="size-5" />} />
        <button
          type="button"
          onClick={end}
          disabled={busy}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-lg",
            "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
            "h-16 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-red-300",
            "disabled:opacity-60",
          )}
        >
          <PhoneOff className="size-5" />
          <span className="text-[11px] font-semibold tracking-wide">END (E)</span>
        </button>
      </div>
    </div>
  );
}

function ControlBtn({
  label, hotkey, active, onClick, icon,
}: { label: string; hotkey?: string; active?: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border h-16 transition",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        active ? "bg-primary/10 border-primary/30 text-primary" : "bg-background hover:bg-muted",
      )}
    >
      {icon}
      <span className="text-[11px] font-medium">
        {label}{hotkey ? ` (${hotkey})` : ""}
      </span>
    </button>
  );
}

/** Compact recording consent banner — for use above forms / on call start. */
export function RecordingConsentBanner({ notice, required }: { notice?: string | null; required?: boolean }) {
  if (!notice) return null;
  return (
    <div className={cn(
      "rounded-md border px-3 py-2 text-xs flex items-start gap-2",
      required ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-muted/50 text-muted-foreground",
    )}>
      <UsersIcon className="size-4 mt-0.5 shrink-0" />
      <span>{notice}</span>
    </div>
  );
}