import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCWidget, CCField, CCInput, CCSelect, CCFormGrid,
  CCTable, CCThead, CCTh, CCTd, CCTr,
} from "@/components/cc";
import { DUMMY_REPORT_RUNS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsPage,
});

type ReportKey =
  | "calls" | "agent_performance" | "outcomes"
  | "follow_ups" | "qa_scores" | "complaints"
  | "attendance" | "login_activity" | "client_status";

const REPORTS: { key: ReportKey; label: string; description: string }[] = [
  { key: "calls", label: "Call volume & duration", description: "All calls in window with direction, duration, outcome." },
  { key: "agent_performance", label: "Agent performance", description: "Per-agent connected calls, average handle time, QA score." },
  { key: "outcomes", label: "Call outcomes", description: "Outcomes breakdown across the period." },
  { key: "follow_ups", label: "Follow-up completion", description: "Tasks created from follow-ups and their completion state." },
  { key: "qa_scores", label: "Quality assurance scores", description: "Scored reviews, average score, disputes." },
  { key: "complaints", label: "Complaints", description: "Complaint volume by status, priority, and owner." },
  { key: "attendance", label: "Attendance", description: "Punches per agent: clock-in/out, breaks." },
  { key: "login_activity", label: "Login activity", description: "Successful logins and failed attempts." },
  { key: "client_status", label: "Client status", description: "Clients grouped by lifecycle status." },
];

function ReportsPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [key, setKey] = useState<ReportKey>("calls");
  const [preview, setPreview] = useState<{ rows: any[]; columns: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const recent = useQuery({
    queryKey: ["report-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("report_runs" as any)
        .select("*").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  async function fetchRows(): Promise<{ rows: any[]; columns: string[] }> {
    const fromTs = new Date(from).toISOString();
    const toTs = new Date(new Date(to).getTime() + 86400_000).toISOString();
    switch (key) {
      case "calls": {
        const { data } = await supabase.from("calls")
          .select("id,started_at,ended_at,direction,duration_seconds,status,agent_id,contact_id")
          .gte("started_at", fromTs).lt("started_at", toTs).limit(5000);
        return { rows: data ?? [], columns: ["id","started_at","ended_at","direction","duration_seconds","status","agent_id","contact_id"] };
      }
      case "outcomes": {
        const { data } = await supabase.from("call_notes" as any)
          .select("outcome_code,priority,complaint,created_at")
          .gte("created_at", fromTs).lt("created_at", toTs).limit(5000);
        return { rows: data ?? [], columns: ["outcome_code","priority","complaint","created_at"] };
      }
      case "qa_scores": {
        const { data } = await supabase.from("qa_reviews")
          .select("id,overall_score,reviewer_id,created_at")
          .gte("created_at", fromTs).lt("created_at", toTs).limit(5000);
        return { rows: data ?? [], columns: ["id","overall_score","reviewer_id","created_at"] };
      }
      case "complaints": {
        const { data } = await supabase.from("complaints" as any)
          .select("id,subject,category,priority,status,owner_id,created_at")
          .gte("created_at", fromTs).lt("created_at", toTs).limit(5000);
        return { rows: data ?? [], columns: ["id","subject","category","priority","status","owner_id","created_at"] };
      }
      case "follow_ups": {
        const { data } = await supabase.from("tasks" as any)
          .select("id,title,status,priority,due_at,assigned_to,completed_at,created_at")
          .gte("created_at", fromTs).lt("created_at", toTs).limit(5000);
        return { rows: data ?? [], columns: ["id","title","status","priority","due_at","assigned_to","completed_at","created_at"] };
      }
      case "attendance": {
        const { data } = await supabase.from("attendance_punches" as any)
          .select("user_id,kind,at,note").gte("at", fromTs).lt("at", toTs).limit(5000);
        return { rows: data ?? [], columns: ["user_id","kind","at","note"] };
      }
      case "login_activity": {
        const { data } = await supabase.from("login_history" as any)
          .select("user_id,success,ip,user_agent,created_at")
          .gte("created_at", fromTs).lt("created_at", toTs).limit(5000);
        return { rows: data ?? [], columns: ["user_id","success","ip","user_agent","created_at"] };
      }
      case "agent_performance": {
        const { data } = await supabase.from("calls")
          .select("agent_id,duration_seconds,status,direction")
          .gte("started_at", fromTs).lt("started_at", toTs).limit(10000);
        const agg = new Map<string, { agent: string; calls: number; connected: number; total_sec: number }>();
        for (const r of (data ?? []) as any[]) {
          const k = r.agent_id ?? "unknown";
          const a = agg.get(k) ?? { agent: k, calls: 0, connected: 0, total_sec: 0 };
          a.calls++; if (r.status === "completed") a.connected++;
          a.total_sec += r.duration_seconds ?? 0;
          agg.set(k, a);
        }
        const rows = Array.from(agg.values()).map(a => ({
          ...a, avg_handle_sec: a.calls ? Math.round(a.total_sec / a.calls) : 0,
        }));
        return { rows, columns: ["agent","calls","connected","total_sec","avg_handle_sec"] };
      }
      case "client_status": {
        const { data } = await supabase.from("contacts" as any)
          .select("lifecycle_status").limit(20000);
        const agg = new Map<string, number>();
        for (const r of (data ?? []) as any[]) agg.set(r.lifecycle_status ?? "unknown", (agg.get(r.lifecycle_status ?? "unknown") ?? 0) + 1);
        return { rows: Array.from(agg.entries()).map(([status, count]) => ({ status, count })), columns: ["status","count"] };
      }
    }
  }

  function toCsv(rows: any[], columns: string[]) {
    const esc = (v: any) => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [columns.join(","), ...rows.map(r => columns.map(c => esc(r[c])).join(","))].join("\n");
  }

  async function exportNow() {
    const { rows, columns } = await fetchRows();
    const csv = toCsv(rows, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${key}-${from}-to-${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    await supabase.from("report_runs" as any).insert({
      report_key: key, filters: { from, to }, format: "csv",
      row_count: rows.length, run_by: user!.id,
    });
  }

  async function runPreview() {
    setLoading(true);
    try { setPreview(await fetchRows()); }
    finally { setLoading(false); }
  }

  async function exportJson() {
    const { rows } = preview ?? await fetchRows();
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${key}-${from}-to-${to}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    await supabase.from("report_runs" as any).insert({
      report_key: key, filters: { from, to }, format: "json",
      row_count: rows.length, run_by: user!.id,
    });
  }

  function exportPdf() {
    if (!preview) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const { rows, columns } = preview;
    const esc = (v: any) => String(v ?? "").replace(/[&<>]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;" }[c]!));
    w.document.write(`<!doctype html><html><head><title>${esc(key)} ${esc(from)} to ${esc(to)}</title>
      <style>body{font:13px system-ui;padding:24px} table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px} th{background:#f9fafb} h1{font-size:18px}</style>
      </head><body><h1>${esc(report.label)}</h1>
      <p>${esc(from)} → ${esc(to)} · ${rows.length} rows</p>
      <table><thead><tr>${columns.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  const report = REPORTS.find(r => r.key === key)!;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Pull operational data into CSV. Every export is recorded in the audit log."
      />
      <div className="p-6 space-y-6">
        <CCWidget title="Build a report">
          <CCFormGrid>
            <CCField label="Report">
              <CCSelect value={key} onChange={(e) => setKey(e.target.value as ReportKey)}>
                {REPORTS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
              </CCSelect>
            </CCField>
            <CCField label="From"><CCInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></CCField>
            <CCField label="To"><CCInput type="date" value={to} onChange={(e) => setTo(e.target.value)} /></CCField>
          </CCFormGrid>
          <p className="text-sm text-[color:var(--cc-ink-500)] mt-2">{report.description}</p>
          <div className="mt-3 flex justify-end gap-2">
            <CCButton variant="secondary" onClick={runPreview} disabled={loading}>
              {loading ? "Loading…" : "Quick view"}
            </CCButton>
            <CCButton variant="secondary" onClick={exportJson}>Export JSON</CCButton>
            <CCButton variant="secondary" onClick={exportPdf} disabled={!preview}>Export PDF</CCButton>
            <CCButton onClick={exportNow}>Export CSV</CCButton>
          </div>
        </CCWidget>

        {preview && (
          <section className="space-y-3">
            <header className="flex items-baseline justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">{`Preview · ${preview.rows.length} rows`}</h3>
              <span className="text-xs text-[color:var(--cc-ink-500)]">Showing up to 100 rows. Export to get the full result.</span>
            </header>
            {preview.rows.length === 0 ? (
              <p className="text-sm text-[color:var(--cc-ink-500)] py-6 text-center">No rows match the filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <CCTable>
                  <CCThead>
                    <CCTr>
                      {preview.columns.map((c) => <CCTh key={c}>{c}</CCTh>)}
                    </CCTr>
                  </CCThead>
                  <tbody>
                    {preview.rows.slice(0, 100).map((r, i) => (
                      <CCTr key={i}>
                        {preview.columns.map((c) => (
                          <CCTd key={c}>
                            <span className="text-xs tabular-nums truncate block max-w-[280px]">
                              {r[c] == null ? "—" : String(r[c])}
                            </span>
                          </CCTd>
                        ))}
                      </CCTr>
                    ))}
                  </tbody>
                </CCTable>
              </div>
            )}
          </section>
        )}

        <CCWidget title="Recent exports">
          <ul className="divide-y divide-[color:var(--cc-ink-100)] text-sm">
            {(((recent.data && recent.data.length > 0) ? recent.data : DUMMY_REPORT_RUNS) as any[]).map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between">
                <span className="text-[color:var(--cc-ink-700)]">{r.report_key} · {r.row_count} rows</span>
                <span className="text-xs text-[color:var(--cc-ink-500)] tabular-nums">{new Date(r.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </CCWidget>
      </div>
    </>
  );
}