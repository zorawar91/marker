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
 * Cells are click-to-edit so one OCR error can be corrected without corrupting
 * the trend (P1 "inline value correction") — edits update all views immediately.
 */
export function FullTable({
  reports,
  onEdit,
}: {
  reports: Report[];
  onEdit?: (reportId: string, canonicalId: string, newValue: number) => void;
}) {
  const [editing, setEditing] = useState<{ reportId: string; canonicalId: string } | null>(null);
  const [draft, setDraft] = useState("");
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

  const startEdit = (reportId: string, canonicalId: string, value: number) => {
    if (!onEdit) return;
    setEditing({ reportId, canonicalId });
    setDraft(String(value));
  };

  const commit = () => {
    if (!editing) return;
    const n = parseFloat(draft);
    if (Number.isFinite(n)) onEdit?.(editing.reportId, editing.canonicalId, n);
    setEditing(null);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink)]">All extracted values</h2>
          <p className="mt-0.5 text-xs text-[var(--ink-2)]">
            Every value across every report — colored by range, dated to its source.{" "}
            {onEdit ? "Click any value to correct an extraction error." : "Use it to verify the extraction."}
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
                    const isEditing = editing?.reportId === r.id && editing?.canonicalId === s.canonicalId;
                    if (isEditing) {
                      return (
                        <td key={r.id} className="px-2 py-1.5 text-right">
                          <input
                            autoFocus
                            inputMode="decimal"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commit();
                              if (e.key === "Escape") setEditing(null);
                            }}
                            className="w-20 rounded-md border border-[var(--primary)] bg-[var(--surface)] px-2 py-1 text-right tnum text-[var(--ink)] outline-none"
                          />
                        </td>
                      );
                    }
                    return (
                      <td
                        key={r.id}
                        onClick={() => reading && startEdit(r.id, s.canonicalId, reading.value)}
                        title={reading && onEdit ? "Click to correct this value" : undefined}
                        className={`px-3 py-2.5 text-right tnum ${reading && onEdit ? "cursor-pointer hover:bg-[var(--surface-3)]" : ""}`}
                        style={{ color: reading ? cellColor(reading.status) : "var(--ink-3)" }}
                      >
                        {reading ? (
                          <span className="inline-flex items-center gap-1">
                            {reading.edited && (
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]"
                                title="Edited"
                              />
                            )}
                            {formatValue(reading.value)}
                          </span>
                        ) : (
                          "—"
                        )}
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
