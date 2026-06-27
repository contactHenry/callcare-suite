import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Dashboard widget system. Every dashboard metric uses one of these
 * primitives so adding a new metric never requires a new design pass.
 */
export function CCWidget({
  title, hint, footer, children, className,
}: {
  title: string;
  hint?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "cc-surface rounded-[var(--cc-radius-lg)] shadow-[var(--cc-shadow-sm)] p-[var(--cc-space-5)] flex flex-col gap-3",
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">{title}</h3>
        {hint && <span className="text-xs text-[color:var(--cc-ink-500)]">{hint}</span>}
      </header>
      <div className="flex-1 min-w-0">{children}</div>
      {footer && <footer className="pt-2 border-t border-[color:var(--cc-ink-100)] text-xs text-[color:var(--cc-ink-500)]">{footer}</footer>}
    </section>
  );
}

export function CCMetricWidget({
  title, value, sub, trend, tone = "neutral",
}: {
  title: string;
  value: string | number;
  sub?: string;
  trend?: { points: number[]; deltaPct?: number };
  tone?: "neutral" | "positive" | "negative" | "warning";
}) {
  const toneColor =
    tone === "positive" ? "var(--cc-success)" :
    tone === "negative" ? "var(--cc-danger)" :
    tone === "warning"  ? "oklch(0.65 0.15 70)" : "var(--cc-brand)";
  return (
    <CCWidget title={title}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-semibold tracking-tight text-[color:var(--cc-ink-900)] tabular-nums">{value}</div>
          {sub && <div className="mt-1 text-xs text-[color:var(--cc-ink-500)]">{sub}</div>}
          {trend?.deltaPct != null && (
            <div className="mt-1 text-xs font-medium" style={{ color: trend.deltaPct >= 0 ? "var(--cc-success)" : "var(--cc-danger)" }}>
              {trend.deltaPct >= 0 ? "▲" : "▼"} {Math.abs(trend.deltaPct).toFixed(1)}%
            </div>
          )}
        </div>
        {trend && <CCSparkline points={trend.points} color={toneColor} />}
      </div>
    </CCWidget>
  );
}

/** Brand-styled sparkline — no external chart library, no defaults. */
export function CCSparkline({
  points, color = "var(--cc-brand)", width = 96, height = 32,
}: { points: number[]; color?: string; width?: number; height?: number }) {
  if (!points.length) return <div style={{ width, height }} />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const d = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / range) * (height - 2) - 1;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastX = (points.length - 1) * step;
  const lastY = height - ((points[points.length - 1] - min) / range) * (height - 2) - 1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity="0.10" />
      <path d={d} stroke={color} strokeWidth="1.75" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.25" fill={color} />
    </svg>
  );
}

/** Vertical bar chart used for hourly call volume etc. */
export function CCBarChart({
  data, height = 120, color = "var(--cc-brand)", formatX,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatX?: (label: string) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d) => {
          const h = Math.max(2, (d.value / max) * (height - 4));
          return (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-1" title={`${d.label}: ${d.value}`}>
              <div
                className="w-full rounded-t-sm transition-all"
                style={{ height: h, background: color, opacity: 0.85 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 text-[10px] text-[color:var(--cc-ink-500)]">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center truncate">{formatX ? formatX(d.label) : d.label}</div>
        ))}
      </div>
    </div>
  );
}

export function CCProgressBar({
  value, max = 100, tone = "brand", showLabel = true,
}: { value: number; max?: number; tone?: "brand" | "success" | "warning" | "danger"; showLabel?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const c =
    tone === "success" ? "var(--cc-success)" :
    tone === "warning" ? "oklch(0.7 0.15 70)" :
    tone === "danger"  ? "var(--cc-danger)" : "var(--cc-brand)";
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-[color:var(--cc-ink-100)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
      </div>
      {showLabel && (
        <div className="flex justify-between text-[10px] text-[color:var(--cc-ink-500)] tabular-nums">
          <span>{value}</span><span>{max}</span>
        </div>
      )}
    </div>
  );
}