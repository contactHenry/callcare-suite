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

let current: CallSession | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export function setActiveCall(session: CallSession | null) {
  current = session;
  emit();
}

export function getActiveCall(): CallSession | null { return current; }

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useActiveCall(): CallSession | null {
  return useSyncExternalStore(subscribe, getActiveCall, () => null);
}