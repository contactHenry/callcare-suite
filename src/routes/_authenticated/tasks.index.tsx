import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import {
  listTasks, createTask, updateTaskStatus, addTaskComment, getTaskDetail,
} from "@/lib/workflow.functions";
import {
  CCButton, CCFormSection, CCFormGrid, CCField, CCInput, CCTextarea, CCSelect,
  CCStatusPill, CCTable, CCThead, CCTh, CCTd, CCTr,
} from "@/components/cc";
import { DUMMY_TASKS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/tasks/")({
  component: TasksPage,
});

function TasksPage() {
  const { atLeast } = useAuth();
  const qc = useQueryClient();
  const [scope, setScope] = useState<"mine" | "team" | "all">("mine");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const tasks = useQuery({
    queryKey: ["tasks", scope, overdueOnly],
    queryFn: () => listTasks({ data: { scope, overdueOnly } }),
  });
  const rows: any[] = (tasks.data && tasks.data.length > 0) ? tasks.data : DUMMY_TASKS;
  const openTask = openTaskId ? rows.find((t) => t.id === openTaskId) : null;

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
              {rows.map((t: any) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onOpen={() => setOpenTaskId(t.id)}
                  onChange={() => qc.invalidateQueries({ queryKey: ["tasks"] })}
                />
              ))}
            </tbody>
        </CCTable>
      </div>

      {openNew && <NewTaskDialog onClose={() => setOpenNew(false)} />}
      {openTaskId && <TaskDetailDialog id={openTaskId} fallback={openTask} onClose={() => setOpenTaskId(null)} />}
    </>
  );
}

function TaskRow({ task, onChange, onOpen }: { task: any; onChange: () => void; onOpen: () => void }) {
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
    <CCTr className="cursor-pointer" onClick={onOpen}>
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
      <CCTd className="text-right" onClick={(e) => e.stopPropagation()}>
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
  const [remindAt, setRemindAt] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const create = useMutation({
    mutationFn: () => createTask({ data: {
      title, description, priority: priority as any,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      remindAt: remindAt ? new Date(remindAt).toISOString() : null,
      recurrenceRule: recurrence || null,
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
            <CCField label="Remind at" hint="In-app alert fires at this time">
              <CCInput type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
            </CCField>
            <CCField label="Recurrence">
              <CCSelect value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                <option value="">One-off</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </CCSelect>
            </CCField>
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

function TaskDetailDialog({ id, fallback, onClose }: { id: string; fallback?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["task-detail", id],
    queryFn: async () => {
      try { return await getTaskDetail({ data: { id } }); } catch { return null; }
    },
    retry: false,
  });
  const [comment, setComment] = useState("");
  const post = useMutation({
    mutationFn: () => addTaskComment({ data: { taskId: id, body: comment } }),
    onSuccess: () => { setComment(""); detail.refetch(); },
  });
  const update = useMutation({
    mutationFn: (status: any) => updateTaskStatus({ data: { id, status } }),
    onSuccess: () => { detail.refetch(); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });
  const t = detail.data?.task ?? fallback;
  const comments = detail.data?.comments ?? DUMMY_TASK_COMMENTS;
  const attachments = detail.data?.attachments ?? [];
  const activity = DUMMY_TASK_ACTIVITY;
  const overdue = t?.due_at && new Date(t.due_at) < new Date() && t.status !== "completed";
  const statusTone: any =
    t?.status === "completed" ? "success" :
    t?.status === "escalated" ? "danger" :
    overdue ? "danger" : t?.status === "in_progress" ? "info" : "neutral";
  const priorityTone: any = t?.priority === "urgent" || t?.priority === "high" ? "danger" : t?.priority === "low" ? "neutral" : "info";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <CCFormSection
          title={t?.title ?? "Task"}
          hint={t?.recurrence_rule ? `Recurs · ${t.recurrence_rule}` : (t?.client?.name ? `Client · ${t.client.name}` : undefined)}
          actions={
            t && t.status !== "completed" && (
              <div className="flex gap-2">
                <CCButton size="sm" variant="secondary" onClick={() => update.mutate("escalated")}>Escalate</CCButton>
                <CCButton size="sm" variant="success" onClick={() => update.mutate("completed")}>Complete</CCButton>
              </div>
            )
          }
        >
          {!t ? <div className="text-sm text-muted-foreground">Loading…</div> : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <CCStatusPill tone={statusTone} dot>
                  {overdue && t.status !== "completed" ? "overdue" : String(t.status ?? "open").replace("_", " ")}
                </CCStatusPill>
                <CCStatusPill tone={priorityTone} dot>{t.priority ?? "normal"}</CCStatusPill>
                {t.channel && <CCStatusPill tone="neutral">{t.channel}</CCStatusPill>}
                {t.recurrence_rule && <CCStatusPill tone="info">Recurs · {t.recurrence_rule}</CCStatusPill>}
              </div>

              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <Field label="Due">{t.due_at ? new Date(t.due_at).toLocaleString() : "—"}</Field>
                <Field label="Created">{t.created_at ? new Date(t.created_at).toLocaleString() : "—"}</Field>
                <Field label="Assignee">{t.assignee?.full_name ?? t.owner?.full_name ?? "Unassigned"}</Field>
                <Field label="Client">{t.client?.name ?? "—"}</Field>
                <Field label="Phone">{t.client?.phone ?? "—"}</Field>
                <Field label="Source call">{t.source_call_id ?? "—"}</Field>
              </div>
              {t.description && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)] mb-1">Description</div>
                  <p className="text-sm whitespace-pre-wrap">{t.description}</p>
                </div>
              )}
              {t.reason && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)] mb-1">Reason</div>
                  <p className="text-sm whitespace-pre-wrap">{t.reason}</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">Activity</div>
                <ul className="space-y-1.5 text-sm">
                  {activity.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-xs text-[color:var(--cc-ink-500)] w-32 shrink-0 tabular-nums">{new Date(a.at).toLocaleString()}</span>
                      <span><span className="font-medium">{a.actor}</span> {a.event}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">Comments</div>
                <ul className="space-y-2">
                  {comments.map((c: any) => (
                    <li key={c.id} className="rounded-md border border-[color:var(--cc-ink-200)] p-2 text-sm">
                      <div className="text-xs text-[color:var(--cc-ink-500)]">
                        {c.author?.full_name ?? "User"} · {new Date(c.created_at).toLocaleString()}
                      </div>
                      <div className="whitespace-pre-wrap">{c.body}</div>
                    </li>
                  ))}
                  {comments.length === 0 && <li className="text-xs text-[color:var(--cc-ink-500)]">No comments yet.</li>}
                </ul>
                <div className="flex gap-2">
                  <CCTextarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" />
                  <CCButton onClick={() => post.mutate()} disabled={!comment.trim() || post.isPending}>Post</CCButton>
                </div>
              </div>

              {attachments.length ? (
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">Attachments</div>
                  <ul className="text-sm list-disc pl-5">
                    {attachments.map((a: any) => (
                      <li key={a.id}><a className="underline" href={a.url ?? "#"} target="_blank" rel="noreferrer">{a.filename ?? a.id}</a></li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex justify-end">
                <CCButton variant="ghost" onClick={onClose}>Close</CCButton>
              </div>
            </>
          )}
        </CCFormSection>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-[color:var(--cc-ink-500)]">{label}</div>
      <div className="text-[color:var(--cc-ink-900)]">{children}</div>
    </div>
  );
}

const DUMMY_TASK_COMMENTS = [
  { id: "c1", author: { full_name: "Liam Carter" }, created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),  body: "Left a voicemail and sent a follow-up SMS with the callback window." },
  { id: "c2", author: { full_name: "Olivia Brown" }, created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(), body: "Approved the discount up to 10%. Proceed if it saves the account." },
];
const DUMMY_TASK_ACTIVITY = [
  { at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),  actor: "Liam Carter",  event: "created this task" },
  { at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),  actor: "Liam Carter",  event: "moved status to in progress" },
  { at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),      actor: "Olivia Brown", event: "left a comment" },
];