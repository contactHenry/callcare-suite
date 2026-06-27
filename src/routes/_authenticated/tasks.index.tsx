import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import {
  listTasks, createTask, updateTaskStatus, addTaskComment,
} from "@/lib/workflow.functions";
import {
  CCButton, CCFormSection, CCFormGrid, CCField, CCInput, CCTextarea, CCSelect,
  CCStatusPill, CCTable, CCThead, CCTh, CCTd, CCTr,
} from "@/components/cc";

export const Route = createFileRoute("/_authenticated/tasks/")({
  component: TasksPage,
});

function TasksPage() {
  const { atLeast } = useAuth();
  const qc = useQueryClient();
  const [scope, setScope] = useState<"mine" | "team" | "all">("mine");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const tasks = useQuery({
    queryKey: ["tasks", scope, overdueOnly],
    queryFn: () => listTasks({ data: { scope, overdueOnly } }),
  });

  const [openNew, setOpenNew] = useState(false);

  return (
    <>
      <PageHeader
        title="Tasks & follow-ups"
        description="Daily work list. Overdue items escalate to your supervisor automatically."
        actions={<CCButton onClick={() => setOpenNew(true)}>New task</CCButton>}
      />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          {(["mine", "team", "all"] as const).map((s) => {
            const visible = s === "mine" || atLeast(s === "all" ? "supervisor" : "team_leader");
            if (!visible) return null;
            const active = scope === s;
            return (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors " +
                  (active
                    ? "bg-[var(--cc-brand-600)] text-white border-[var(--cc-brand-600)]"
                    : "bg-[color:var(--cc-ink-0)] text-[color:var(--cc-ink-700)] border-[color:var(--cc-ink-200)] hover:border-[color:var(--cc-ink-300)]")
                }
              >
                {s === "mine" ? "My tasks" : s === "team" ? "Team" : "All"}
              </button>
            );
          })}
          <label className="ml-3 inline-flex items-center gap-2 text-xs text-[color:var(--cc-ink-700)]">
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
            Overdue only
          </label>
        </div>

        <div className="cc-surface rounded-[var(--cc-radius-lg)] shadow-[var(--cc-shadow-sm)] overflow-hidden">
          <CCTable>
            <CCThead>
              <tr>
                <CCTh>Task</CCTh>
                <CCTh>Client</CCTh>
                <CCTh>Due</CCTh>
                <CCTh>Priority</CCTh>
                <CCTh>Status</CCTh>
                <CCTh></CCTh>
              </tr>
            </CCThead>
            <tbody>
              {(tasks.data ?? []).map((t: any) => (
                <TaskRow key={t.id} task={t} onChange={() => qc.invalidateQueries({ queryKey: ["tasks"] })} />
              ))}
              {tasks.data && tasks.data.length === 0 && (
                <CCTr>
                  <CCTd className="text-[color:var(--cc-ink-500)]">No tasks. You're caught up.</CCTd>
                  <CCTd /><CCTd /><CCTd /><CCTd /><CCTd />
                </CCTr>
              )}
            </tbody>
          </CCTable>
        </div>
      </div>

      {openNew && <NewTaskDialog onClose={() => setOpenNew(false)} />}
    </>
  );
}

function TaskRow({ task, onChange }: { task: any; onChange: () => void }) {
  const overdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== "completed";
  const tone: any = task.priority === "urgent" || task.priority === "high"
    ? "danger" : task.priority === "low" ? "neutral" : "info";
  const statusTone: any =
    task.status === "completed" ? "success" :
    task.status === "escalated" ? "danger" :
    overdue ? "danger" : task.status === "in_progress" ? "info" : "neutral";
  const update = useMutation({
    mutationFn: (status: any) => updateTaskStatus({ data: { id: task.id, status } }),
    onSuccess: onChange,
  });
  return (
    <CCTr>
      <CCTd>
        <div className="font-medium text-[color:var(--cc-ink-900)]">{task.title}</div>
        {task.description && <div className="text-xs text-[color:var(--cc-ink-500)] line-clamp-1">{task.description}</div>}
      </CCTd>
      <CCTd className="text-[color:var(--cc-ink-700)]">{task.client?.name ?? "—"}</CCTd>
      <CCTd className="text-[color:var(--cc-ink-700)] tabular-nums">
        {task.due_at ? new Date(task.due_at).toLocaleString() : "—"}
      </CCTd>
      <CCTd><CCStatusPill tone={tone} dot>{task.priority}</CCStatusPill></CCTd>
      <CCTd>
        <CCStatusPill tone={statusTone} dot>
          {overdue && task.status !== "completed" ? "overdue" : task.status.replace("_", " ")}
        </CCStatusPill>
      </CCTd>
      <CCTd className="text-right">
        {task.status !== "completed" ? (
          <div className="flex justify-end gap-2">
            {task.status === "open" && (
              <CCButton size="sm" variant="secondary" onClick={() => update.mutate("in_progress")}>Start</CCButton>
            )}
            <CCButton size="sm" variant="success" onClick={() => update.mutate("completed")}>Complete</CCButton>
          </div>
        ) : (
          <span className="text-xs text-[color:var(--cc-ink-500)]">Done</span>
        )}
      </CCTd>
    </CCTr>
  );
}

function NewTaskDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueAt, setDueAt] = useState("");
  const create = useMutation({
    mutationFn: () => createTask({ data: {
      title, description, priority: priority as any,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    }}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); onClose(); },
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CCFormSection title="New task">
          <CCFormGrid>
            <CCField label="Title"><CCInput value={title} onChange={(e) => setTitle(e.target.value)} /></CCField>
            <CCField label="Priority">
              <CCSelect value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </CCSelect>
            </CCField>
            <CCField label="Due"><CCInput type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></CCField>
          </CCFormGrid>
          <CCField label="Description"><CCTextarea value={description} onChange={(e) => setDescription(e.target.value)} /></CCField>
          <div className="flex justify-end gap-2">
            <CCButton variant="ghost" onClick={onClose}>Cancel</CCButton>
            <CCButton onClick={() => create.mutate()} disabled={!title || create.isPending}>Create</CCButton>
          </div>
        </CCFormSection>
      </div>
    </div>
  );
}