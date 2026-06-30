import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import {
  listScripts, createScript, getScript, saveScriptDraft,
  submitScriptForReview, approveScriptVersion, acknowledgeScript,
  type ScriptNode,
} from "@/lib/scripts.functions";
import {
  CCButton, CCFormSection, CCFormGrid, CCField, CCInput, CCTextarea, CCSelect,
  CCStatusPill,
} from "@/components/cc";
import { Plus, Trash2 } from "lucide-react";
import { DUMMY_SCRIPTS, DUMMY_SCRIPT_TREE, DUMMY_SCRIPT_VERSIONS } from "@/lib/dummy-data";
import { LiveScript } from "@/components/LiveScript";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/scripts/")({
  component: ScriptsPage,
});

type Tree = { rootId: string | null; nodes: ScriptNode[] };

function ScriptsPage() {
  const { atLeast } = useAuth();
  const canEdit = atLeast("team_leader");
  const canApprove = atLeast("supervisor");

  const qc = useQueryClient();
  const scripts = useQuery({ queryKey: ["scripts"], queryFn: () => listScripts({ data: {} }) });
  const scriptList: any[] = (scripts.data && scripts.data.length > 0) ? scripts.data : DUMMY_SCRIPTS;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingName, setCreatingName] = useState("");

  const create = useMutation({
    mutationFn: () => createScript({ data: { name: creatingName } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["scripts"] }); setSelectedId(r.script.id); setCreatingName(""); },
  });

  return (
    <>
      <PageHeader
        title="Call scripts"
        description="Branching scripts with versioning and approval. Agents acknowledge updates."
      />
      <div className="p-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-2">
          {canEdit && (
            <div className="flex gap-2">
              <CCInput placeholder="New script name…" value={creatingName} onChange={(e) => setCreatingName(e.target.value)} />
              <CCButton size="sm" onClick={() => create.mutate()} disabled={!creatingName}>Add</CCButton>
            </div>
          )}
          <ul className="cc-surface rounded-[var(--cc-radius-lg)] shadow-[var(--cc-shadow-sm)] divide-y divide-[color:var(--cc-ink-100)]">
            {scriptList.map((s: any) => (
              <li key={s.id}>
                <button
                  onClick={() => setSelectedId(s.id)}
                  className={
                    "w-full text-left px-3 py-2 hover:bg-[color:var(--cc-ink-50)] " +
                    (selectedId === s.id ? "bg-[color:var(--cc-ink-50)]" : "")
                  }
                >
                  <div className="text-sm font-medium text-[color:var(--cc-ink-900)]">{s.name}</div>
                  <div className="text-xs text-[color:var(--cc-ink-500)] flex gap-2 items-center mt-0.5">
                    <span>v{s.current_version?.version ?? 1}</span>
                    <CCStatusPill tone={s.current_version?.status === "approved" ? "success" : "info"}>
                      {s.current_version?.status ?? "draft"}
                    </CCStatusPill>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {selectedId
          ? <ScriptEditor id={selectedId} canEdit={canEdit} canApprove={canApprove} />
          : <div className="cc-surface rounded-[var(--cc-radius-lg)] p-8 text-sm text-[color:var(--cc-ink-500)]">Select a script to view or edit.</div>}
      </div>
    </>
  );
}

function ScriptEditor({ id, canEdit, canApprove }: { id: string; canEdit: boolean; canApprove: boolean }) {
  const qc = useQueryClient();
  const isDummy = id.startsWith("dummy-");
  const q = useQuery({
    queryKey: ["script", id],
    queryFn: () => getScript({ data: { id } }),
    enabled: !isDummy,
  });
  const dummyScript = DUMMY_SCRIPTS.find((s) => s.id === id);
  const data = isDummy
    ? {
        script: { id, name: dummyScript?.name ?? "Sample script" },
        versions: DUMMY_SCRIPT_VERSIONS.map((v) =>
          v.version === (dummyScript?.current_version?.version ?? 4)
            ? { ...v, status: dummyScript?.current_version?.status ?? v.status, tree: DUMMY_SCRIPT_TREE }
            : v,
        ),
      }
    : q.data;

  const latest = data?.versions[0];
  const isDraft = latest?.status === "draft";
  const [tree, setTree] = useState<Tree>({ rootId: null, nodes: [] });
  const [changelog, setChangelog] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useMemo(() => {
    if (latest?.tree) setTree(latest.tree as Tree);
  }, [latest?.id]);

  const save = useMutation({
    mutationFn: () => saveScriptDraft({ data: { scriptId: id, tree, changelog } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["script", id] }),
  });
  const submit = useMutation({
    mutationFn: () => submitScriptForReview({ data: { versionId: latest!.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["script", id] }),
  });
  const approve = useMutation({
    mutationFn: () => approveScriptVersion({ data: { versionId: latest!.id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["script", id] }); qc.invalidateQueries({ queryKey: ["scripts"] }); },
  });
  const ack = useMutation({
    mutationFn: () => acknowledgeScript({ data: { versionId: latest!.id } }),
  });

  if (!data) return <div className="text-sm">Loading…</div>;

  function addNode(kind: ScriptNode["kind"]) {
    const id = crypto.randomUUID();
    const node: ScriptNode = { id, kind, text: "", mandatory: kind === "compliance" || kind === "question" };
    setTree((t) => ({ rootId: t.rootId ?? id, nodes: [...t.nodes, node] }));
  }
  function updateNode(id: string, patch: Partial<ScriptNode>) {
    setTree((t) => ({ ...t, nodes: t.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  }
  function deleteNode(id: string) {
    setTree((t) => ({
      rootId: t.rootId === id ? null : t.rootId,
      nodes: t.nodes.filter((n) => n.id !== id),
    }));
  }

  return (
    <div className="space-y-4">
      <CCFormSection
        title={data.script.name}
        hint={`v${latest?.version} · ${latest?.status}`}
        actions={
          <div className="flex gap-2">
            <CCButton size="sm" variant="ghost" onClick={() => setPreviewOpen(true)}>Preview as agent</CCButton>
            {canEdit && isDraft && <CCButton size="sm" variant="secondary" onClick={() => save.mutate()}>Save draft</CCButton>}
            {canEdit && isDraft && <CCButton size="sm" onClick={() => submit.mutate()}>Submit for review</CCButton>}
            {canApprove && latest?.status === "in_review" && <CCButton size="sm" variant="success" onClick={() => approve.mutate()}>Approve & publish</CCButton>}
            {!canEdit && latest?.status === "approved" && <CCButton size="sm" onClick={() => ack.mutate()}>{ack.isSuccess ? "Acknowledged ✓" : "Acknowledge"}</CCButton>}
          </div>
        }
      >
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {(["say", "question", "objection", "compliance", "faq"] as const).map((k) => (
              <CCButton key={k} size="sm" variant="secondary" onClick={() => addNode(k)}>
                <Plus className="size-3" /> {k}
              </CCButton>
            ))}
          </div>
        )}
        <ol className="space-y-3 mt-3">
          {tree.nodes.map((n, i) => (
            <li key={n.id} className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CCStatusPill tone={n.kind === "compliance" ? "danger" : n.kind === "objection" ? "warning" : "info"}>
                  {n.kind}
                </CCStatusPill>
                {n.mandatory && <CCStatusPill tone="warning">mandatory</CCStatusPill>}
                {tree.rootId === n.id && <CCStatusPill tone="success">start</CCStatusPill>}
                <div className="ml-auto flex gap-2">
                  {canEdit && tree.rootId !== n.id && (
                    <button className="text-xs underline text-[color:var(--cc-ink-500)]" onClick={() => setTree((t) => ({ ...t, rootId: n.id }))}>Set start</button>
                  )}
                  {canEdit && (
                    <button className="text-xs text-[color:var(--cc-danger)]" onClick={() => deleteNode(n.id)}><Trash2 className="size-3.5" /></button>
                  )}
                </div>
              </div>
              <CCTextarea
                value={n.text}
                onChange={(e) => updateNode(n.id, { text: e.target.value })}
                placeholder={`Step ${i + 1}: what should the agent say?`}
                disabled={!canEdit || !isDraft}
              />
              {(n.kind === "question" || n.kind === "objection") && (
                <div className="space-y-1">
                  <div className="text-xs text-[color:var(--cc-ink-500)]">Branches (client answer → next step)</div>
                  {(n.branches ?? []).map((b, bi) => (
                    <div key={bi} className="flex gap-2">
                      <CCInput
                        placeholder="If client says…"
                        value={b.value}
                        onChange={(e) => {
                          const branches = [...(n.branches ?? [])];
                          branches[bi] = { ...b, value: e.target.value };
                          updateNode(n.id, { branches });
                        }}
                        disabled={!canEdit || !isDraft}
                      />
                      <CCSelect
                        value={b.nextId}
                        onChange={(e) => {
                          const branches = [...(n.branches ?? [])];
                          branches[bi] = { ...b, nextId: e.target.value };
                          updateNode(n.id, { branches });
                        }}
                        disabled={!canEdit || !isDraft}
                      >
                        <option value="">→ Go to step…</option>
                        {tree.nodes.filter((x) => x.id !== n.id).map((x, xi) => (
                          <option key={x.id} value={x.id}>{xi + 1}. {x.kind} — {x.text.slice(0, 32) || "(empty)"}</option>
                        ))}
                      </CCSelect>
                    </div>
                  ))}
                  {canEdit && isDraft && (
                    <CCButton
                      size="sm" variant="ghost"
                      onClick={() => updateNode(n.id, { branches: [...(n.branches ?? []), { value: "", nextId: "" }] })}
                    >
                      <Plus className="size-3" /> Add branch
                    </CCButton>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
        {canEdit && isDraft && (
          <CCField label="Changelog">
            <CCInput value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="What changed?" />
          </CCField>
        )}
      </CCFormSection>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-sm">Agent preview — {data.script.name}</DialogTitle>
          </DialogHeader>
          <div className="h-[480px] flex flex-col">
            <LiveScript tree={tree} />
          </div>
        </DialogContent>
      </Dialog>

      <CCFormSection title="Version history">
        <ul className="text-sm divide-y divide-[color:var(--cc-ink-100)]">
          {data.versions.map((v: any) => (
            <li key={v.id} className="py-2 flex items-center justify-between gap-3">
              <div>v{v.version} <span className="text-xs text-[color:var(--cc-ink-500)] ml-2">{v.changelog ?? "—"}</span></div>
              <CCStatusPill tone={v.status === "approved" ? "success" : v.status === "in_review" ? "info" : "neutral"}>{v.status}</CCStatusPill>
            </li>
          ))}
        </ul>
      </CCFormSection>
    </div>
  );
}