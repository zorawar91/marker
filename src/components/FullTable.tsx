"use client";

import { useMemo, useState } from "react";
import { BIOMARKERS, panelLabel } from "@/lib/biomarkers";
import { buildAllSeries, sortReports } from "@/lib/classify";
import { DIRECTION_META, STATE_META, formatMonthYear, formatValue } from "@/lib/display";
import type { Direction, Report } from "@/lib/types";

type SortKey = "panel" | "name" | "state";

/**
 * Every extracted value in one sortable matrix (markers × report dates).
 * Doubles as the extraction-verification surface (P1 "Full table view"): each
 * cell is colored by its in/out-of-range status and dated to its source report.
 */
export function FullTable({ reports }: { reports: Report[] }) {
  const sorted = useMemo(() => sortReports(reports), [reports]);
  const series = useMemo(() => buildAllSeries(reports), [reports]);
  const [sortKey, setSortKey] = useState<SortKey>("panel");

  const rows = useMemo(() => {
    const stateRank: Record<string, number> = { concern: 0, watching: 1, single: 2, improving: 3, stable: 4 };
    const panelRank: Record<string, number> = {
      lipids: 0, glucose: 1, thyroid: 2, cbc: 3, liver: 4, kidney: 5, vitamins: 6, other: 7,
    };
    const arr = [...series];
    arr.sort((a, b) => {
      const ma = BIOMARKERS[a.canonicalId];
      const mb = BIOMARKERS[b.canonicalId];
      if (sortKey === "name") return ma.displayName.localeCompare(mb.displayName);
      if (sortKey === "state") return stateRank[a.state] - stateRank[b.state];
      // panel: group by panel, then by state within panel
      const p = panelRank[ma.panel] - panelRank[mb.panel];
      return p !== 0 ? p : stateRank[a.state] - stateRank[b.state];
    });
    return arr;
  }, [series, sortKey]);

  const cellColor = (status: Direction): string =>
    status === "high" || status === "low" ? DIRECTION_META[status].color : "var(--ink)";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink)]">All extracted values</h2>
          <p className="mt-0.5 text-xs text-[var(--ink-2)]">
            Every value across every report — colored by range, dated to its source. Use it to verify the extraction.
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-[var(--ink-3)]">Sort</span>
          {(["panel", "name", "state"] as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSortKey(k)}
              className={`rounded-md px-2 py-1 font-medium capitalize transition-colors ${
                sortKey === k
                  ? "bg-[var(--primary-soft)] text-[var(--primary-ink)]"
                  : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {k === "state" ? "trend" : k}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <th className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-2.5 text-xs font-semibold text-[var(--ink-2)]">
                Biomarker
              </th>
              <th className="px-3 py-2.5 text-xs font-semibold text-[var(--ink-2)]">Trend</th>
              {sorted.map((r) => (
                <th key={r.id} className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-[var(--ink-2)]">
                  {formatMonthYear(r.reportDate)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const marker = BIOMARKERS[s.canonicalId];
              const st = STATE_META[s.state];
              return (
                <tr key={s.canonicalId} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-2.5">
                    <div className="font-medium text-[var(--ink)]">{marker.displayName}</div>
                    <div className="text-xs text-[var(--ink-3)]">
                      {panelLabel(marker.panel)} · {marker.canonicalUnit}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="chip" style={{ color: st.color, background: st.bg }}>
                      <span className="chip-dot" />
                      {st.label}
                    </span>
                  </td>
                  {sorted.map((r) => {
                    const reading = r.readings.find((x) => x.canonicalId === s.canonicalId);
                    return (
                      <td key={r.id} className="px-3 py-2.5 text-right tnum" style={{ color: reading ? cellColor(reading.status) : "var(--ink-3)" }}>
                        {reading ? formatValue(reading.value) : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
