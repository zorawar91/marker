"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BIOMARKERS } from "@/lib/biomarkers";
import { buildAllSeries, sortReports } from "@/lib/classify";
import { STATE_META, formatMonthYear } from "@/lib/display";
import type { Report } from "@/lib/types";

// Distinct line colors for overlaid markers.
const PALETTE = ["#4f46e5", "#0d9488", "#db2777", "#d97706", "#0891b2", "#7c3aed", "#059669", "#dc2626"];

/**
 * Overlay multiple markers on one chart (P1 "Compare Trends"). Because markers
 * have different units and scales, each is indexed to 100 at its own first
 * reading — so the chart shows *relative* movement, letting you see which
 * markers are climbing or falling fastest against their own baseline.
 */
export function CompareView({ reports }: { reports: Report[] }) {
  const sorted = useMemo(() => sortReports(reports), [reports]);
  const series = useMemo(() => buildAllSeries(reports), [reports]);

  // Default selection: the flagged markers, capped so the chart stays legible.
  const [selected, setSelected] = useState<string[]>(() => {
    const flagged = series.filter((s) => s.state === "concern" || s.state === "watching").map((s) => s.canonicalId);
    const pick = flagged.length ? flagged : series.map((s) => s.canonicalId);
    return pick.slice(0, 5);
  });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 8 ? [...prev, id] : prev));

  // Build one row per report date; each selected marker indexed to its first reading = 100.
  const data = useMemo(() => {
    const baseline: Record<string, number> = {};
    for (const id of selected) {
      const s = series.find((x) => x.canonicalId === id);
      const first = s?.points[0]?.value;
      if (first && first !== 0) baseline[id] = first;
    }
    return sorted.map((rep) => {
      const row: Record<string, number | string | null> = { label: formatMonthYear(rep.reportDate) };
      for (const id of selected) {
        const reading = rep.readings.find((r) => r.canonicalId === id);
        row[id] = reading && baseline[id] ? Math.round((reading.value / baseline[id]) * 1000) / 10 : null;
      }
      return row;
    });
  }, [sorted, selected, series]);

  const colorFor = (id: string) => PALETTE[selected.indexOf(id) % PALETTE.length];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)]">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Compare trends</h2>
        <p className="mt-0.5 text-xs text-[var(--ink-2)]">
          Each marker is indexed to <span className="font-medium text-[var(--ink)]">100</span> at its first reading, so you
          can compare movement across different units. A line rising above 100 means that marker has increased since your
          first report.
        </p>

        <div className="mt-4 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 2, left: 2 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--ink-3)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} padding={{ left: 8, right: 8 }} />
              <YAxis tick={{ fill: "var(--ink-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${v}`} />
              <ReferenceLine y={100} stroke="var(--border-2)" strokeDasharray="4 4" label={{ value: "baseline", fill: "var(--ink-3)", fontSize: 10, position: "insideTopRight" }} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: "var(--shadow-md)",
                  fontSize: 12,
                  padding: "8px 10px",
                }}
                formatter={(value, name) => {
                  const id = String(name);
                  const v = Number(value);
                  return [`${v} (${v >= 100 ? "+" : ""}${Math.round(v - 100)}%)`, BIOMARKERS[id]?.displayName ?? id];
                }}
              />
              <Legend
                formatter={(value) => <span style={{ color: "var(--ink-2)", fontSize: 12 }}>{BIOMARKERS[String(value)]?.displayName ?? value}</span>}
              />
              {selected.map((id) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={id}
                  stroke={colorFor(id)}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Marker picker */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)]">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--ink-2)]">Markers to overlay</h3>
          <span className="text-xs text-[var(--ink-3)]">{selected.length}/8 selected</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {series.map((s) => {
            const marker = BIOMARKERS[s.canonicalId];
            const on = selected.includes(s.canonicalId);
            const st = STATE_META[s.state];
            return (
              <button
                key={s.canonicalId}
                type="button"
                onClick={() => toggle(s.canonicalId)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  on
                    ? "border-transparent text-white"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
                }`}
                style={on ? { background: colorFor(s.canonicalId) } : undefined}
              >
                {!on && <span className="chip-dot" style={{ color: st.color }} />}
                {marker.displayName}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
