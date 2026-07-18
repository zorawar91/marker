"use client";

import { useEffect, useState } from "react";
import { normalizeReport } from "@/lib/normalize";
import { clearReports, loadReports, saveReports } from "@/lib/storage";
import { sampleReports } from "@/lib/samples";
import type { ExtractedReport, Report } from "@/lib/types";
import { deriveStatus } from "@/lib/normalize";
import { CompareView } from "./CompareView";
import { Dashboard } from "./Dashboard";
import { FullTable } from "./FullTable";
import { ThemeToggle } from "./ThemeToggle";
import { UploadZone, type FileStatus } from "./UploadZone";

const DISCLAIMER =
  "Marker helps you read and track your reports. It is not medical advice and does not diagnose.";

type View = "dashboard" | "table" | "compare";

export function MarkerApp() {
  const [reports, setReports] = useState<Report[]>([]);
  const [statuses, setStatuses] = useState<FileStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("dashboard");

  useEffect(() => {
    setReports(loadReports());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveReports(reports);
  }, [reports, hydrated]);

  const hasReports = reports.length > 0;
  const canCompare = reports.length > 1;

  const processFiles = async (files: File[]) => {
    setBusy(true);
    setStatuses(files.map((f) => ({ fileName: f.name, state: "processing" as const })));

    const setStatus = (i: number, s: Partial<FileStatus>) =>
      setStatuses((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...s } : p)));

    const added: Report[] = [];
    await Promise.all(
      files.map(async (file, i) => {
        try {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch("/api/extract", { method: "POST", body: form });
          const data = await res.json();

          if (!res.ok) {
            setStatus(i, { state: "error", message: data.error ?? "Failed" });
            return;
          }
          const extracted = data.extracted as ExtractedReport;
          if (!extracted.isLabReport) {
            setStatus(i, { state: "error", message: extracted.rejectionReason ?? "Not a lab report" });
            return;
          }
          const report = normalizeReport(
            extracted,
            data.fileName ?? file.name,
            `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
          );
          if (report.readings.length === 0) {
            setStatus(i, { state: "error", message: "No recognizable biomarkers found" });
            return;
          }
          added.push(report);
          setStatus(i, { state: "done" });
        } catch {
          setStatus(i, { state: "error", message: "Network error" });
        }
      }),
    );

    if (added.length) {
      setReports((prev) => [...prev, ...added]);
      setShowAdd(false);
    }
    setBusy(false);
  };

  const loadSample = () => {
    setReports(sampleReports());
    setStatuses([]);
    setShowAdd(false);
    setView("dashboard");
  };

  // Inline value correction (P1): update one reading's canonical value, recompute
  // its status against its range, and mark it edited. Trends recompute reactively.
  const updateReading = (reportId: string, canonicalId: string, newValue: number) => {
    setReports((prev) =>
      prev.map((rep) =>
        rep.id !== reportId
          ? rep
          : {
              ...rep,
              readings: rep.readings.map((r) =>
                r.canonicalId !== canonicalId
                  ? r
                  : { ...r, value: newValue, status: deriveStatus(newValue, r.refLow, r.refHigh), edited: true },
              ),
            },
      ),
    );
  };

  const deleteAll = () => {
    if (!window.confirm("Delete all reports and clear your data from this browser? This cannot be undone.")) return;
    clearReports();
    setReports([]);
    setStatuses([]);
    setView("dashboard");
  };

  const tabs: Array<{ id: View; label: string; disabled?: boolean }> = [
    { id: "dashboard", label: "Dashboard" },
    { id: "table", label: "All values" },
    { id: "compare", label: "Compare", disabled: !canCompare },
  ];

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">Marker</span>
            <span className="ml-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-3)]">
              beta
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            {hasReports && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAdd((v) => !v)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink-2)] shadow-[var(--shadow-xs)] hover:bg-[var(--surface-2)]"
                >
                  <span className="sm:hidden">+</span>
                  <span className="hidden sm:inline">+ Add reports</span>
                </button>
                <button
                  type="button"
                  onClick={deleteAll}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--concern)] hover:bg-[var(--concern-bg)]"
                >
                  <span className="sm:hidden">Delete</span>
                  <span className="hidden sm:inline">Delete all</span>
                </button>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
        {/* Tab bar */}
        {hasReports && (
          <div className="border-t border-[var(--border)]">
            <div className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={t.disabled}
                  onClick={() => setView(t.id)}
                  className={`relative px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    view === t.id ? "text-[var(--primary)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]"
                  }`}
                >
                  {t.label}
                  {view === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--primary)]" />}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="border-t border-[var(--border)] bg-[var(--surface-2)]">
          <p className="mx-auto max-w-6xl px-4 py-1.5 text-[11px] text-[var(--ink-2)]">{DISCLAIMER}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {!hasReports ? (
          <Landing>
            <UploadZone onFiles={processFiles} statuses={statuses} busy={busy} onTrySample={loadSample} />
          </Landing>
        ) : (
          <>
            {showAdd && (
              <div className="mb-8">
                <UploadZone onFiles={processFiles} statuses={statuses} busy={busy} onTrySample={loadSample} />
              </div>
            )}
            {view === "dashboard" && <Dashboard reports={reports} />}
            {view === "table" && <FullTable reports={reports} onEdit={updateReading} />}
            {view === "compare" && canCompare && <CompareView reports={reports} />}
          </>
        )}
      </main>

      <footer className="border-t border-[var(--border)] px-4 py-6 text-center print:hidden">
        <p className="mx-auto max-w-2xl text-[11px] leading-relaxed text-[var(--ink-3)]">
          Privacy: your extracted data is stored only in this browser (local storage). Uploaded PDFs are sent to an AI
          extraction service to read their values and are not stored on any server. Use “Delete all” to remove everything.
        </p>
      </footer>
    </div>
  );
}

function Landing({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-72 grid-backdrop" aria-hidden />
      <div className="relative mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--ink-2)] shadow-[var(--shadow-xs)]">
            <span className="chip-dot" style={{ color: "var(--accent)" }} />
            Document AI for lab reports
          </span>
          <h1 className="mt-4 text-[2.1rem] font-semibold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-5xl">
            Your health reports,
            <br />
            <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">
              finally readable
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--ink-2)]">
            Upload lab report PDFs from any lab and any year. Marker reads them, lines up every biomarker on one timeline,
            flags what’s drifting, and explains what each number means — in plain English.
          </p>
        </div>
        {children}

        <div className="mx-auto mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
          <Step n="1" title="Upload PDFs">From any lab, India or abroad — no templates.</Step>
          <Step n="2" title="See the trend">Every marker on one multi-year timeline.</Step>
          <Step n="3" title="Understand it">Plain-English notes + questions for your doctor.</Step>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)]">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary-ink)]">
        {n}
      </div>
      <div className="mt-2.5 text-sm font-semibold text-[var(--ink)]">{title}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-[var(--ink-2)]">{children}</div>
    </div>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="var(--primary)" />
      <path d="M6 15l3.5-4 2.5 3 2-2.5L18 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
