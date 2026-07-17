"use client";

import { useMemo } from "react";
import { BIOMARKERS, PANELS, panelLabel } from "@/lib/biomarkers";
import { buildAllSeries, isNotable, sortReports } from "@/lib/classify";
import { formatDate, formatValue } from "@/lib/display";
import { generateQuestions } from "@/lib/questions";
import type { Panel, Report, Series } from "@/lib/types";
import { BiomarkerCard } from "./BiomarkerCard";
import { DoctorQuestions } from "./DoctorQuestions";

export function Dashboard({ reports }: { reports: Report[] }) {
  const sorted = useMemo(() => sortReports(reports), [reports]);
  const series = useMemo(() => buildAllSeries(reports), [reports]);
  const questions = useMemo(() => generateQuestions(series), [series]);

  // Overview banner: counts from the latest report (R3).
  const latest = sorted[sorted.length - 1];
  const counts = useMemo(() => {
    const c = { normal: 0, high: 0, low: 0 };
    for (const r of latest?.readings ?? []) {
      if (r.status === "normal") c.normal++;
      else if (r.status === "high") c.high++;
      else if (r.status === "low") c.low++;
    }
    return c;
  }, [latest]);

  // Notable values (>2x upper / <0.5x lower) from the latest report (R4 severity tier).
  const notable = useMemo(
    () => (latest?.readings ?? []).filter(isNotable),
    [latest],
  );

  // Patient-name mismatch guard (review gap #1): if reports carry >1 distinct
  // name, the timelines may be mixing people — warn rather than silently merge.
  const names = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports) if (r.patientName?.trim()) set.add(r.patientName.trim());
    return [...set];
  }, [reports]);

  const ambiguousDates = reports.filter((r) => r.dateAmbiguous);

  // Group series by panel, ordered; within a panel, most-concerning first.
  const byPanel = useMemo(() => {
    const stateRank: Record<Series["state"], number> = {
      concern: 0,
      watching: 1,
      single: 2,
      improving: 3,
      stable: 4,
    };
    const groups = new Map<Panel, Series[]>();
    for (const s of series) {
      const panel = BIOMARKERS[s.canonicalId]?.panel ?? "other";
      const arr = groups.get(panel) ?? [];
      arr.push(s);
      groups.set(panel, arr);
    }
    for (const arr of groups.values()) arr.sort((a, b) => stateRank[a.state] - stateRank[b.state]);
    return groups;
  }, [series]);

  return (
    <div className="space-y-6">
      {/* Overview KPI header */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">Latest report</h2>
            <p className="mt-0.5 text-xs text-[var(--ink-2)]">
              {latest?.labName ? `${latest.labName} · ` : ""}
              {formatDate(latest?.reportDate ?? null)} · {reports.length} report
              {reports.length > 1 ? "s" : ""}, {series.length} biomarker{series.length > 1 ? "s" : ""} tracked
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="In range" value={counts.normal} color="var(--ok)" bg="var(--ok-bg)" />
          <Stat label="Above range" value={counts.high} color="var(--concern)" bg="var(--concern-bg)" />
          <Stat label="Below range" value={counts.low} color="var(--watch)" bg="var(--watch-bg)" />
        </div>
      </section>

      {/* Data-quality warnings */}
      {names.length > 1 && (
        <Warning tone="concern">
          These reports carry more than one patient name ({names.join(", ")}). Their values are being
          shown on one timeline, which can mix different people together. Per-person profiles are coming;
          for now, upload reports for one person at a time for an accurate trend.
        </Warning>
      )}
      {ambiguousDates.length > 0 && (
        <Warning tone="watch">
          {ambiguousDates.length} report{ambiguousDates.length > 1 ? "s have" : " has"} a date that
          could not be read unambiguously (day vs. month order). The trend order may be affected — check
          the source dates on each marker.
        </Warning>
      )}

      {/* Notable values alert */}
      {notable.length > 0 && (
        <section className="rounded-xl border border-[var(--concern)] bg-[var(--concern-bg)] p-5 shadow-[var(--shadow-xs)]">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--concern)] text-xs font-bold text-white">
              !
            </span>
            <h2 className="text-sm font-semibold text-[var(--concern)]">Notable values</h2>
          </div>
          <p className="mt-1.5 text-xs text-[var(--ink-2)]">
            Well outside the reference range in your latest report — worth raising with your doctor.
          </p>
          <ul className="mt-3 divide-y divide-[var(--concern)]/15">
            {notable.map((r) => (
              <li key={r.canonicalId} className="flex items-baseline justify-between gap-2 py-1.5 text-sm">
                <span className="font-medium text-[var(--ink)]">{BIOMARKERS[r.canonicalId].displayName}</span>
                <span className="tnum text-[var(--ink-2)]">
                  {formatValue(r.value)} {r.unit}
                  {r.refHigh !== null && r.value > r.refHigh && ` (ref < ${formatValue(r.refHigh)})`}
                  {r.refLow !== null && r.value < r.refLow && ` (ref > ${formatValue(r.refLow)})`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Doctor questions */}
      <DoctorQuestions questions={questions} />

      {/* Panels */}
      {PANELS.map(({ id }) => {
        const items = byPanel.get(id);
        if (!items || items.length === 0) return null;
        return (
          <section key={id}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-2)]">{panelLabel(id)}</h2>
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--ink-3)]">
                {items.length}
              </span>
              <div className="ml-1 h-px flex-1 bg-[var(--border)]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => (
                <BiomarkerCard key={s.canonicalId} series={s} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3" style={{ background: bg }}>
      <div className="tnum text-2xl font-semibold tracking-tight" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-[var(--ink-2)]">
        <span className="chip-dot" style={{ color }} />
        {label}
      </div>
    </div>
  );
}

function Warning({ tone, children }: { tone: "concern" | "watch"; children: React.ReactNode }) {
  const color = tone === "concern" ? "var(--concern)" : "var(--watch)";
  const bg = tone === "concern" ? "var(--concern-bg)" : "var(--watch-bg)";
  return (
    <div className="rounded-xl border p-4 text-sm" style={{ borderColor: color, background: bg, color: "var(--ink-2)" }}>
      {children}
    </div>
  );
}
