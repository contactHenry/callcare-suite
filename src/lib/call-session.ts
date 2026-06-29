/**
 * Global in-call session store.
 *
 * One active call per agent at a time. Lives outside React's tree so the
 * persistent in-call bar (rendered in `AppShell`) survives navigation and
 * never tears the WebRTC session down when the agent jumps from the dialer
 * to a client profile to add notes mid-call.
 */
import { useSyncExternalStore } from "react";
import type { CallSession } from "@/components/CallControlBar";

/** A call that ended and is waiting for the agent's after-call wrap-up. */
export type PendingWrapUp = {
  callId: string;
  contactName?: string | null;
  partyNumber?: string | null;
  campaignId?: string | null;
  endedAt: string;      // ISO
  deadlineAt: string;   // ISO — soft SLA, agent can snooze past it
};

let current: CallSession | null = null;
let pending: PendingWrapUp[] = [];
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

/** Default after-call work window (seconds). Configurable per-org later. */
export const WRAP_UP_WINDOW_SECONDS = 180;

export function setActiveCall(session: CallSession | null) {
  current = session;
  emit();
}

export function getActiveCall(): CallSession | null { return current; }

export function getPendingWrapUps(): PendingWrapUp[] { return pending; }

export function queueWrapUp(w: Omit<PendingWrapUp, "deadlineAt"> & { deadlineAt?: string }) {
  if (pending.some((p) => p.callId === w.callId)) return;
  pending = [
    ...pending,
    {
      ...w,
      deadlineAt: w.deadlineAt ?? new Date(Date.now() + WRAP_UP_WINDOW_SECONDS * 1000).toISOString(),
    },
  ];
  emit();
}

export function clearWrapUp(callId: string) {
  pending = pending.filter((p) => p.callId !== callId);
  emit();
}

export function snoozeWrapUp(callId: string, addSeconds = 120) {
  pending = pending.map((p) =>
    p.callId === callId
      ? { ...p, deadlineAt: new Date(Date.now() + addSeconds * 1000).toISOString() }
      : p,
  );
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useActiveCall(): CallSession | null {
  return useSyncExternalStore(subscribe, getActiveCall, () => null);
}

export function usePendingWrapUps(): PendingWrapUp[] {
  return useSyncExternalStore(subscribe, getPendingWrapUps, () => []);
}