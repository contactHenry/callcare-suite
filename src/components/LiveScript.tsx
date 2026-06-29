/**
 * Live-call script runner. Walks a `ScriptNode` tree, surfaces mandatory
 * questions, branching choices, objection-handling and compliance steps
 * the way an agent sees them during a live call. Also used by the script
 * builder's "Preview as agent" mode so admins see exactly what agents see.
 */
import { useMemo, useState } from "react";
import type { ScriptNode } from "@/lib/scripts.functions";
import { CCButton, CCStatusPill } from "@/components/cc";
import { CheckCircle2, AlertTriangle, BookOpenText, MessageSquareWarning, FileCheck2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScriptTree = { rootId: string | null; nodes: ScriptNode[] };

const KIND_META: Record<ScriptNode["kind"], { label: string; tone: any; icon: React.ReactNode }> = {
  say:        { label: "Say",        tone: "info",    icon: <BookOpenText className="size-3.5" /> },
  question:   { label: "Ask",        tone: "brand",   icon: <HelpCircle className="size-3.5" /> },
  objection:  { label: "Objection",  tone: "warning", icon: <MessageSquareWarning className="size-3.5" /> },
  compliance: { label: "Compliance", tone: "danger",  icon: <FileCheck2 className="size-3.5" /> },
  faq:        { label: "FAQ",        tone: "neutral", icon: <BookOpenText className="size-3.5" /> },
};

export function LiveScript({
  tree, compact = false, onComplete,
}: {
  tree: ScriptTree;
  compact?: boolean;
  onComplete?: () => void;
}) {
  const byId = useMemo(() => Object.fromEntries(tree.nodes.map((n) => [n.id, n])), [tree.nodes]);
  const [currentId, setCurrentId] = useState<string | null>(tree.rootId ?? tree.nodes[0]?.id ?? null);
  const [done, setDone] = useState<Record<string, true>>({});
  const [history, setHistory] = useState<string[]>([]);

  if (!tree.nodes.length) {
    return (
      <div className="text-xs text-[color:var(--cc-ink-500)] p-4 text-center">
        No script content yet.
      </div>
    );
  }

  const node = currentId ? byId[currentId] : null;
  const mandatoryRemaining = tree.nodes.filter((n) => n.mandatory && !done[n.id]).length;

  function go(nextId: string | null | undefined) {
    if (!node) return;
    setDone((d) => ({ ...d, [node.id]: true }));
    setHistory((h) => [...h, node.id]);
    if (nextId && byId[nextId]) setCurrentId(nextId);
    else if (mandatoryRemaining <= 1) onComplete?.();
    else setCurrentId(null);
  }
  function back() {
    setHistory((h) => {
      const next = [...h];
      const last = next.pop();
      if (last) setCurrentId(last);
      return next;
    });
  }

  return (
    <div className={cn("flex flex-col h-full", compact ? "text-sm" : "text-[15px]")}>
      {/* Progress strip — glanceable while on the call */}
      <div className="px-3 py-2 border-b border-[color:var(--cc-ink-100)] flex items-center gap-2 text-xs">
        <span className="font-medium text-[color:var(--cc-ink-700)]">
          Step {history.length + (node ? 1 : 0)} / {tree.nodes.length}
        </span>
        {mandatoryRemaining > 0 ? (
          <CCStatusPill tone="warning">
            <AlertTriangle className="size-3" /> {mandatoryRemaining} mandatory left
          </CCStatusPill>
        ) : (
          <CCStatusPill tone="success">
            <CheckCircle2 className="size-3" /> all mandatory done
          </CCStatusPill>
        )}
        <button
          type="button"
          onClick={back}
          disabled={!history.length}
          className="ml-auto text-xs underline text-[color:var(--cc-ink-500)] disabled:opacity-40"
        >
          Back
        </button>
      </div>

      {/* Current node — large, readable, no scroll dependency */}
      <div className="px-4 py-3 flex-1 overflow-auto">
        {node ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CCStatusPill tone={KIND_META[node.kind].tone}>
                {KIND_META[node.kind].icon} {KIND_META[node.kind].label}
              </CCStatusPill>
              {node.mandatory && <CCStatusPill tone="danger">required</CCStatusPill>}
            </div>
            <p className={cn(
              "whitespace-pre-wrap leading-snug font-medium text-[color:var(--cc-ink-900)]",
              compact ? "text-base" : "text-lg",
            )}>
              {node.text || <span className="italic text-[color:var(--cc-ink-400)]">(empty)</span>}
            </p>

            {/* Branches — labelled buttons so the agent doesn't have to read+decide */}
            {node.branches && node.branches.length > 0 ? (
              <div className="grid gap-1.5 pt-1">
                {node.branches.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(b.nextId)}
                    className="text-left rounded-md border border-[color:var(--cc-ink-200)] hover:border-[color:var(--cc-brand-400)] hover:bg-[color:var(--cc-brand-50)] px-3 py-2 text-sm font-medium"
                  >
                    <span className="text-[color:var(--cc-ink-500)] text-xs mr-2">If they say</span>
                    {b.value || "—"}
                  </button>
                ))}
                {node.nextId && (
                  <button
                    type="button"
                    onClick={() => go(node.nextId)}
                    className="text-left rounded-md border border-dashed border-[color:var(--cc-ink-200)] hover:bg-[color:var(--cc-ink-50)] px-3 py-2 text-sm"
                  >
                    Otherwise · continue
                  </button>
                )}
              </div>
            ) : (
              <CCButton size="sm" onClick={() => go(node.nextId)}>
                {node.nextId ? "Next step" : "Mark done"}
              </CCButton>
            )}
          </div>
        ) : (
          <div className="text-center py-8 space-y-2">
            <CheckCircle2 className="size-8 mx-auto text-[color:var(--cc-success)]" />
            <div className="text-sm font-medium">Script complete</div>
            <div className="text-xs text-[color:var(--cc-ink-500)]">Wrap the call when ready.</div>
          </div>
        )}
      </div>
    </div>
  );
}