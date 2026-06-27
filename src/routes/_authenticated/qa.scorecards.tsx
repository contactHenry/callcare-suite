import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { listScorecards, upsertScorecard } from "@/lib/qa.functions";
import {
  CCButton, CCFormSection, CCFormGrid, CCField, CCInput, CCSelect, CCTextarea, CCCheckbox, CCStatusPill,
} from "@/components/cc";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa/scorecards")({
  component: ScorecardsPage,
});

type Item = { prompt: string; weight: number; maxScore: number; isCritical?: boolean };
type Section = { name: string; items: Item[] };

function ScorecardsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["scorecards"], queryFn: () => listScorecards() });
  const [editing, setEditing] = useState<any | null>(null);

  return (
    <>
      <PageHeader
        title="QA scorecards"
        description="Weighted scoring with pass/fail thresholds. Drives random reviews and trend tracking."
        actions={<CCButton onClick={() => setEditing({ name: "", passThreshold: 80, sections: [] })}>New scorecard</CCButton>}
      />
      <div className="p-6 grid gap-4 lg:grid-cols-2">
        {(list.data ?? []).map((s: any) => {
          const totalWeight = (s.sections ?? []).reduce((a: number, sec: any) => a + sec.items.reduce((b: number, it: any) => b + Number(it.weight), 0), 0);
          return (
            <article key={s.id} className="cc-surface rounded-[var(--cc-radius-lg)] shadow-[var(--cc-shadow-sm)] p-5 space-y-3">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[color:var(--cc-ink-900)]">{s.name}</h3>
                  <p className="text-xs text-[color:var(--cc-ink-500)]">Pass ≥ {s.pass_threshold}% · total weight {totalWeight}</p>
                </div>
                <CCButton size="sm" variant="secondary" onClick={() => setEditing({
                  id: s.id, name: s.name, description: s.description, passThreshold: Number(s.pass_threshold),
                  sections: (s.sections ?? []).map((sec: any) => ({
                    name: sec.name,
                    items: (sec.items ?? []).map((it: any) => ({
                      prompt: it.prompt, weight: Number(it.weight), maxScore: it.max_score, isCritical: it.is_critical,
                    })),
                  })),
                })}>Edit</CCButton>
              </header>
              <ul className="text-sm space-y-1">
                {(s.sections ?? []).map((sec: any) => (
                  <li key={sec.id}>
                    <span className="font-medium">{sec.name}</span>
                    <span className="text-[color:var(--cc-ink-500)]"> · {sec.items?.length ?? 0} items</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
        {list.data && list.data.length === 0 && (
          <p className="text-sm text-[color:var(--cc-ink-500)]">No scorecards yet — create the first one.</p>
        )}
      </div>

      {editing && <ScorecardEditor draft={editing} onClose={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["scorecards"] }); }} />}
    </>
  );
}

function ScorecardEditor({ draft, onClose }: { draft: any; onClose: () => void }) {
  const [name, setName] = useState(draft.name ?? "");
  const [description, setDescription] = useState(draft.description ?? "");
  const [pass, setPass] = useState<number>(draft.passThreshold ?? 80);
  const [sections, setSections] = useState<Section[]>(draft.sections ?? []);

  const save = useMutation({
    mutationFn: () => upsertScorecard({ data: { id: draft.id, name, description, passThreshold: pass, sections } }),
    onSuccess: onClose,
  });

  function patchSection(i: number, p: Partial<Section>) {
    setSections((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));
  }
  function patchItem(si: number, ii: number, p: Partial<Item>) {
    setSections((s) => s.map((x, j) => j === si ? { ...x, items: x.items.map((it, k) => k === ii ? { ...it, ...p } : it) } : x));
  }

  const totalWeight = sections.reduce((a, sec) => a + sec.items.reduce((b, it) => b + Number(it.weight || 0), 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
        <CCFormSection
          title={draft.id ? "Edit scorecard" : "New scorecard"}
          actions={
            <div className="flex gap-2">
              <CCButton variant="ghost" onClick={onClose}>Cancel</CCButton>
              <CCButton onClick={() => save.mutate()} disabled={!name || save.isPending}>{save.isPending ? "Saving…" : "Save"}</CCButton>
            </div>
          }
        >
          <CCFormGrid>
            <CCField label="Name"><CCInput value={name} onChange={(e) => setName(e.target.value)} /></CCField>
            <CCField label="Pass threshold (%)"><CCInput type="number" value={pass} onChange={(e) => setPass(Number(e.target.value))} /></CCField>
          </CCFormGrid>
          <CCField label="Description"><CCTextarea value={description} onChange={(e) => setDescription(e.target.value)} /></CCField>

          <div className="text-xs text-[color:var(--cc-ink-500)]">Total weight across all items: <b className="text-[color:var(--cc-ink-900)]">{totalWeight}</b></div>

          {sections.map((sec, si) => (
            <div key={si} className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] p-3 space-y-2">
              <div className="flex gap-2">
                <CCInput value={sec.name} onChange={(e) => patchSection(si, { name: e.target.value })} placeholder="Section name" />
                <CCButton size="sm" variant="ghost" onClick={() => setSections((s) => s.filter((_, j) => j !== si))}>
                  <Trash2 className="size-3.5" />
                </CCButton>
              </div>
              {sec.items.map((it, ii) => (
                <div key={ii} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6"><CCInput value={it.prompt} onChange={(e) => patchItem(si, ii, { prompt: e.target.value })} placeholder="Question / criterion" /></div>
                  <div className="col-span-2"><CCInput type="number" value={it.weight} onChange={(e) => patchItem(si, ii, { weight: Number(e.target.value) })} placeholder="Weight" /></div>
                  <div className="col-span-2"><CCSelect value={String(it.maxScore)} onChange={(e) => patchItem(si, ii, { maxScore: Number(e.target.value) })}>
                    {[1,2,3,4,5,10].map((n) => <option key={n} value={n}>/ {n}</option>)}
                  </CCSelect></div>
                  <label className="col-span-1 text-xs text-[color:var(--cc-ink-700)] flex items-center gap-1">
                    <input type="checkbox" checked={!!it.isCritical} onChange={(e) => patchItem(si, ii, { isCritical: e.target.checked })} /> crit
                  </label>
                  <button className="col-span-1 text-[color:var(--cc-danger)]" onClick={() => patchSection(si, { items: sec.items.filter((_, k) => k !== ii) })}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              <CCButton size="sm" variant="ghost" onClick={() => patchSection(si, { items: [...sec.items, { prompt: "", weight: 10, maxScore: 5 }] })}>
                <Plus className="size-3" /> Add item
              </CCButton>
            </div>
          ))}
          <CCButton size="sm" variant="secondary" onClick={() => setSections((s) => [...s, { name: "Section", items: [] }])}>
            <Plus className="size-3.5" /> Add section
          </CCButton>
        </CCFormSection>
      </div>
    </div>
  );
}