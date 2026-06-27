import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { importClients } from "@/lib/clients.functions";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCField } from "@/components/cc";
import { toast } from "sonner";
import { ArrowLeft, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/import")({ component: ImportPage });

/** Naïve CSV parser sufficient for well-formed imports (handles quoted commas). */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];
  const split = (line: string) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i+1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === "," && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur); return out;
  };
  const headers = split(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = split(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}

function ImportPage() {
  const importFn = useServerFn(importClients);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [result, setResult] = useState<{ inserted: number; errors: { row: number; error: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  function handleFile(f: File) {
    setFilename(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCSV(String(reader.result ?? ""));
        setRows(parsed); setResult(null);
      } catch { toast.error("Could not parse CSV"); }
    };
    reader.readAsText(f);
  }

  async function run() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const res = await importFn({ data: { rows } });
      setResult(res);
      toast.success(`Imported ${res.inserted}, ${res.errors.length} errors`);
    } catch (e: any) { toast.error(e?.message ?? "Import failed"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title="Import clients"
        description="Required columns: name. Optional: phone, email, company, campaign_source, notes."
        actions={<Link to="/clients"><CCButton variant="ghost"><ArrowLeft className="size-4 mr-1" />Back</CCButton></Link>}
      />
      <div className="px-6 py-6 space-y-4 max-w-3xl">
        <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4 space-y-3">
          <CCField label="CSV file">
            <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </CCField>
          {filename && <div className="text-xs text-[color:var(--cc-ink-500)]">{filename} — {rows.length} rows</div>}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-t border-[color:var(--cc-ink-100)]">
                <thead className="text-[color:var(--cc-ink-500)]"><tr>{Object.keys(rows[0]).map((h) => <th key={h} className="py-2 px-2 text-left">{h}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-[color:var(--cc-ink-100)]">{Object.keys(rows[0]).map((h) => <td key={h} className="py-1 px-2">{r[h]}</td>)}</tr>
                ))}</tbody>
              </table>
              <div className="mt-2 text-xs text-[color:var(--cc-ink-500)]">Preview of first 5 rows.</div>
            </div>
          )}
          <CCButton disabled={!rows.length || busy} onClick={run}>
            <Upload className="size-4 mr-1" />{busy ? "Importing…" : `Import ${rows.length} rows`}
          </CCButton>
        </div>
        {result && (
          <div className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-white p-4">
            <div className="text-sm font-medium mb-2">Result</div>
            <div className="text-sm">Inserted: <strong>{result.inserted}</strong> · Errors: <strong>{result.errors.length}</strong></div>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-64 overflow-y-auto text-xs text-[color:var(--cc-danger)] space-y-1">
                {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}