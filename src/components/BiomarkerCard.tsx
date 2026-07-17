"use client";

import { useState } from "react";
import { BIOMARKERS } from "@/lib/biomarkers";
import { DIRECTION_META, STATE_META, formatDate, formatValue } from "@/lib/display";
import type { Series } from "@/lib/types";
import { SingleValueBar, TrendChart } from "./TrendChart";

export function BiomarkerCard({ series }: { series: Series }) {
  const marker = BIOMARKERS[series.canonicalId];
  const [showExplain, setShowExplain] = useState(false);
  const state = STATE_META[series.state];
  const latest = series.latest;
  const dir = latest ? DIRECTION_META[latest.status] : null;

  return (
    <div className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--ink)]">{marker.displayName}</h3>
          {latest && (
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="tnum text-2xl font-semibold tracking-tight text-[var(--ink)]">
                {formatValue(latest.value)}
              </span>
              <span className="text-xs text-[var(--ink-3)]">{marker.canonicalUnit}</span>
            </div>
          )}
        </div>
        <span className="chip" style={{ color: state.color, background: state.bg }}>
          <span className="chip-dot" />
          {state.label}
        </span>
      </div>

      {latest && dir && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="chip" style={{ color: dir.color, background: dir.bg }}>
            {dir.label}
          </span>
          {latest.refLow !== null || latest.refHigh !== null ? (
            <span className="text-[var(--ink-3)]">
              Ref{" "}
              {latest.refLow !== null && latest.refHigh !== null
                ? `${formatValue(latest.refLow)}–${formatValue(latest.refHigh)}`
                : latest.refHigh !== null
                  ? `< ${formatValue(latest.refHigh)}`
                  : `> ${formatValue(latest.refLow!)}`}
            </span>
          ) : null}
        </div>
      )}

      <div className="mt-3">
        {series.points.length > 1 ? <TrendChart series={series} /> : <SingleValueBar series={series} />}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-2)]">{series.evidence}</p>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2.5">
        <button
          type="button"
          onClick={() => setShowExplain((v) => !v)}
          className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-ink)]"
          aria-expanded={showExplain}
        >
          {showExplain ? "Hide explanation" : "What is this?"}
        </button>
        <details className="group/src text-right">
          <summary className="cursor-pointer list-none text-xs text-[var(--ink-3)] hover:text-[var(--ink-2)]">
            {series.points.length} reading{series.points.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-[var(--ink-2)]">
            {series.points.map((p, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{formatDate(p.date)}</span>
                <span className="tnum">
                  {formatValue(p.value)} {marker.canonicalUnit}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {showExplain && (
        <p className="mt-2 rounded-lg bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--ink-2)]">
          {marker.explanation}
        </p>
      )}
    </div>
  );
}
