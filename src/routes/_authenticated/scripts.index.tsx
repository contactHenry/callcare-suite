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
import { generateScriptDraft, type GeneratedScript } from "@/lib/scripts-ai.functions";
import {
  CCButton, CCFormSection, CCFormGrid, CCField, CCInput, CCTextarea, CCSelect,
  CCStatusPill,
} from "@/components/cc";
import { Plus, Trash2, Sparkles, FileText, ArrowLeft, Search } from "lucide-react";
import { DUMMY_SCRIPTS, DUMMY_SCRIPT_TREE, DUMMY_SCRIPT_VERSIONS } from "@/lib/dummy-data";
import { LiveScript } from "@/components/LiveScript";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scripts/")({
  component: ScriptsPage,
});

type Tree = { rootId: string | null; nodes: ScriptNode[] };

const CATEGORY_TONES: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  Sales: "info",
  Retention: "success",
  Support: "warning",
  Compliance: "danger",
  Outbound: "neutral",
};

function ScriptsPage() {
  const { atLeast } = useAuth();
  const canEdit = atLeast("team_leader");
  const canApprove = atLeast("supervisor");

  const qc = useQueryClient();
  const scripts = useQuery({ queryKey: ["scripts"], queryFn: () => listScripts({ data: {} }) });
  const scriptList: any[] = (scripts.data && scripts.data.length > 0) ? scripts.data : DUMMY_SCRIPTS;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const s = new Set<string>();
    scriptList.forEach((x) => x.category && s.add(x.category));
    return ["all", ...Array.from(s)];
  }, [scriptList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scriptList.filter((s) => {
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        s.name?.toLowerCase().includes(q) ||
        s.use_case?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      );
    });
  }, [scriptList, query, categoryFilter]);

  if (selectedId) {
    return (
      <>
        <PageHeader
          title="Call script"
          description="Edit, version, and publish this script."
          actions={
            <CCButton size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="size-4" /> Back to templates
            </CCButton>
          }
        />
        <div className="p-6">
          <ScriptEditor id={selectedId} canEdit={canEdit} canApprove={canApprove} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Call scripts"
        description="Ready-to-use templates by use case. Agents open one during a call — leaders create new ones with AI help."
        actions={
          canEdit ? (
            <CCButton size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> New script
            </CCButton>
          ) : null
        }
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--cc-ink-400)]" />
            <CCInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, use case, category…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={
                  "px-3 py-1.5 text-xs rounded-full border transition " +
                  (categoryFilter === c
                    ? "bg-[color:var(--cc-brand-600)] text-white border-transparent"
                    : "bg-white text-[color:var(--cc-ink-600)] border-[color:var(--cc-ink-200)] hover:border-[color:var(--cc-ink-400)]")
                }
              >
                {c === "all" ? "All templates" : c}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="cc-surface rounded-[var(--cc-radius-lg)] p-10 text-center text-sm text-[color:var(--cc-ink-500)]">
            No templates match. {canEdit && "Create one with AI assistance."}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s: any) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="cc-surface rounded-[var(--cc-radius-lg)] p-4 text-left shadow-[var(--cc-shadow-sm)] hover:shadow-md hover:-translate-y-0.5 transition border border-transparent hover:border-[color:var(--cc-ink-200)] flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md bg-[color:var(--cc-brand-50,#f5f3ff)] text-[color:var(--cc-brand-600)] flex items-center justify-center">
                      <FileText className="size-4" />
                    </div>
                    <div className="text-sm font-semibold text-[color:var(--cc-ink-900)] leading-tight">{s.name}</div>
                  </div>
                  {s.category && (
                    <CCStatusPill tone={CATEGORY_TONES[s.category] ?? "info"}>{s.category}</CCStatusPill>
                  )}
                </div>
                <p className="text-xs text-[color:var(--cc-ink-600)] line-clamp-3 min-h-[2.5rem]">
                  {s.use_case ?? s.description ?? "No use case yet — open to add one."}
                </p>
                <div className="flex items-center justify-between text-xs text-[color:var(--cc-ink-500)] pt-1 border-t border-[color:var(--cc-ink-100)]">
                  <span>v{s.current_version?.version ?? 1}</span>
                  <CCStatusPill tone={s.current_version?.status === "approved" ? "success" : s.current_version?.status === "in_review" ? "info" : "neutral"}>
                    {s.current_version?.status ?? "draft"}
                  </CCStatusPill>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <NewScriptDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          onCreated={(id) => { setNewOpen(false); setSelectedId(id); qc.invalidateQueries({ queryKey: ["scripts"] }); }}
        />
      )}
    </>
  );
}

function NewScriptDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Sales");
  const [useCase, setUseCase] = useState("");
  const [tone, setTone] = useState("professional, warm, concise");
  const [steps, setSteps] = useState<GeneratedScript["steps"]>([]);
  const [saving, setSaving] = useState(false);

  const generate = useMutation({
    mutationFn: () => generateScriptDraft({ data: { title, category, useCase, tone } }),
    onSuccess: (r) => {
      if (!title) setTitle(r.title);
      setSteps(r.steps);
      toast.success("Draft generated — review, edit, then save.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't generate. Try again."),
  });

  async function save() {
    if (!title.trim() || steps.length === 0) {
      toast.error("Add a title and at least one step (or generate with AI).");
      return;
    }
    setSaving(true);
    try {
      const created = await createScript({ data: { name: title, description: useCase } });
      const tree = {
        rootId: null as string | null,
        nodes: steps.map((s) => {
          const id = crypto.randomUUID();
          return { id, kind: s.kind, text: s.text, mandatory: s.kind === "compliance" };
        }),
      };
      tree.rootId = tree.nodes[0]?.id ?? null;
      await saveScriptDraft({ data: { scriptId: created.script.id, tree, changelog: `Initial draft — ${category}` } });
      toast.success("Script created.");
      onCreated(created.script.id);
      resetForm();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save script.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setTitle(""); setUseCase(""); setSteps([]); setCategory("Sales");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-[color:var(--cc-brand-600)]" />
            Create a new call script
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <CCFormGrid>
            <CCField label="Title">
              <CCInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Inbound — trial upgrade" />
            </CCField>
            <CCField label="Category">
              <CCSelect value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Sales</option>
                <option>Retention</option>
                <option>Support</option>
                <option>Compliance</option>
                <option>Outbound</option>
                <option>Other</option>
              </CCSelect>
            </CCField>
          </CCFormGrid>

          <CCField label="Use case" hint="Describe when and why an agent uses this script. The AI turns this into a full draft.">
            <CCTextarea
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              rows={3}
              placeholder="e.g. Handle inbound calls from prospects who booked a demo but haven't converted after 7 days. Recap value, address pricing objections, and offer a 14-day extension."
            />
          </CCField>

          <CCField label="Tone (optional)">
            <CCInput value={tone} onChange={(e) => setTone(e.target.value)} placeholder="professional, warm, concise" />
          </CCField>

          <div className="rounded-[var(--cc-radius-md)] border border-dashed border-[color:var(--cc-brand-600)] bg-[color:var(--cc-brand-50,#f5f3ff)] p-3 flex items-start gap-3">
            <Sparkles className="size-4 text-[color:var(--cc-brand-600)] mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-[color:var(--cc-ink-900)]">AI assistant</div>
              <div className="text-xs text-[color:var(--cc-ink-600)] mb-2">
                Don't want to write from scratch? Describe the use case above and let AI draft a branching script you can edit.
              </div>
              <CCButton
                size="sm"
                onClick={() => generate.mutate()}
                disabled={useCase.trim().length < 4 || generate.isPending}
              >
                <Sparkles className="size-3.5" />
                {generate.isPending ? "Generating…" : steps.length ? "Regenerate" : "Generate script with AI"}
              </CCButton>
            </div>
          </div>

          {steps.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-[color:var(--cc-ink-700)]">Draft body ({steps.length} steps)</div>
              <ol className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {steps.map((s, i) => (
                  <li key={i} className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] p-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CCSelect
                        value={s.kind}
                        onChange={(e) => {
                          const next = [...steps];
                          next[i] = { ...s, kind: e.target.value as any };
                          setSteps(next);
                        }}
                        className="w-32"
                      >
                        <option value="say">say</option>
                        <option value="question">question</option>
                        <option value="compliance">compliance</option>
                        <option value="objection">objection</option>
                        <option value="faq">faq</option>
                      </CCSelect>
                      <span className="text-xs text-[color:var(--cc-ink-500)]">Step {i + 1}</span>
                      <button
                        className="ml-auto text-[color:var(--cc-danger)]"
                        onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                        aria-label="Remove step"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <CCTextarea
                      value={s.text}
                      onChange={(e) => {
                        const next = [...steps];
                        next[i] = { ...s, text: e.target.value };
                        setSteps(next);
                      }}
                      rows={2}
                    />
                  </li>
                ))}
              </ol>
              <CCButton
                size="sm" variant="ghost"
                onClick={() => setSteps([...steps, { kind: "say", text: "" }])}
              >
                <Plus className="size-3.5" /> Add step manually
              </CCButton>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--cc-ink-100)]">
            <CCButton variant="ghost" onClick={() => onOpenChange(false)}>Cancel</CCButton>
            <CCButton onClick={save} disabled={saving || !title.trim() || steps.length === 0}>
              {saving ? "Saving…" : "Save draft"}
            </CCButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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