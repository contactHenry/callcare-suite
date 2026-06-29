/**
 * Persistent in-call panel. Rendered once in `AppShell` and reads from the
 * module-level call-session store so it stays mounted (and the timer keeps
 * ticking) regardless of which screen the agent navigates to mid-call.
 */
import { CallControlBar } from "@/components/CallControlBar";
import { useActiveCall, setActiveCall } from "@/lib/call-session";

export function PersistentCallBar() {
  const session = useActiveCall();
  if (!session) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-4">
      <CallControlBar session={session} onEnded={() => setActiveCall(null)} />
    </div>
  );
}