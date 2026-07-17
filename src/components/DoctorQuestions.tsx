"use client";

import { useState } from "react";
import type { DoctorQuestion } from "@/lib/types";

/** Copyable / printable "questions for your doctor" list (R6). */
export function DoctorQuestions({ questions }: { questions: DoctorQuestion[] }) {
  const [copied, setCopied] = useState(false);
  if (questions.length === 0) return null;

  const copy = async () => {
    const text = questions.map((q, i) => `${i + 1}. ${q.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — no-op; the list is still readable/printable on screen
    }
  };

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xs)] print:border-0 print:shadow-none">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Questions for your doctor</h2>
        <div className="flex gap-1.5 print:hidden">
          <button
            type="button"
            onClick={copy}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] shadow-[var(--shadow-xs)] hover:bg-[var(--surface-2)]"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] shadow-[var(--shadow-xs)] hover:bg-[var(--surface-2)]"
          >
            Print
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--ink-2)]">
        Generated from your own trends, phrased as questions to ask — not conclusions.
      </p>
      <ol className="mt-3 space-y-2">
        {questions.map((q, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-[var(--ink)]">
            <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--ink-2)]">
              {i + 1}
            </span>
            <span>{q.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
