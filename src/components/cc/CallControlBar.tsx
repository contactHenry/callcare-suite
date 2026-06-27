import * as React from "react";
import { Mic, MicOff, Pause, Play, PhoneOff, PhoneForwarded, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

function ControlButton({
  label,
  active,
  tone = "neutral",
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  tone?: "neutral" | "danger";
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full cc-focus-ring transition-colors duration-[var(--cc-dur-fast)]",
        tone === "danger"
          ? "bg-[var(--cc-danger)] text-white hover:brightness-95"
          : active
            ? "bg-[var(--cc-brand-600)] text-white"
            : "bg-[var(--cc-ink-100)] text-[color:var(--cc-ink-700)] hover:bg-[var(--cc-ink-200)]",
      )}
    >
      {children}
    </button>
  );
}

export interface CallState {
  muted: boolean;
  onHold: boolean;
  speaker: boolean;
}

export function CCCallControlBar({
  state,
  onToggleMute,
  onToggleHold,
  onToggleSpeaker,
  onTransfer,
  onEnd,
}: {
  state: CallState;
  onToggleMute: () => void;
  onToggleHold: () => void;
  onToggleSpeaker: () => void;
  onTransfer?: () => void;
  onEnd: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Call controls"
      className="flex items-center justify-center gap-3 rounded-[var(--cc-radius-lg)] cc-surface p-[var(--cc-space-3)] shadow-[var(--cc-shadow-md)]"
    >
      <ControlButton label={state.muted ? "Unmute" : "Mute"} active={state.muted} onClick={onToggleMute}>
        {state.muted ? <MicOff /> : <Mic />}
      </ControlButton>
      <ControlButton label={state.onHold ? "Resume" : "Hold"} active={state.onHold} onClick={onToggleHold}>
        {state.onHold ? <Play /> : <Pause />}
      </ControlButton>
      <ControlButton label="Speaker" active={state.speaker} onClick={onToggleSpeaker}>
        <Volume2 />
      </ControlButton>
      {onTransfer && (
        <ControlButton label="Transfer" onClick={onTransfer}>
          <PhoneForwarded />
        </ControlButton>
      )}
      <ControlButton label="End call" tone="danger" onClick={onEnd}>
        <PhoneOff />
      </ControlButton>
    </div>
  );
}