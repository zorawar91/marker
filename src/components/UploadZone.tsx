"use client";

import { useCallback, useRef, useState } from "react";

export interface FileStatus {
  fileName: string;
  state: "processing" | "done" | "error";
  message?: string;
}

/**
 * Drag-and-drop / file-picker upload of 1–10 PDFs in one action (R1).
 * Reports per-file status so a bad PDF names itself instead of failing the batch.
 */
export function UploadZone({
  onFiles,
  statuses,
  busy,
  onTrySample,
}: {
  onFiles: (files: File[]) => void;
  statuses: FileStatus[];
  busy: boolean;
  onTrySample: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const files = Array.from(list).slice(0, 10);
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center shadow-[var(--shadow-xs)] transition-colors ${
          dragging ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border-2)] bg-[var(--surface)] hover:border-[var(--ink-3)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handle(e.target.files)}
        />
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
            <path d="M12 16V4m0 0L8 8m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
          </svg>
        </div>
        <p className="mt-3 font-medium text-[var(--ink)]">
          Drop lab report PDFs here, or click to choose
        </p>
        <p className="mt-1 text-sm text-[var(--ink-2)]">Up to 10 at once, from any lab, any year</p>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onTrySample}
          disabled={busy}
          className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:bg-[var(--primary-ink)] hover:shadow-[var(--shadow-md)] disabled:opacity-50"
        >
          Try with sample reports →
        </button>
        <p className="mt-2 text-xs text-[var(--ink-3)]">
          No reports handy? Load 3 synthetic reports across 3 years and see the full trend.
        </p>
      </div>

      {statuses.length > 0 && (
        <ul className="mt-5 space-y-2">
          {statuses.map((s, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm shadow-[var(--shadow-xs)]"
            >
              <StatusIcon state={s.state} />
              <span className="flex-1 truncate font-medium text-[var(--ink)]">{s.fileName}</span>
              <span
                className="text-xs"
                style={{
                  color:
                    s.state === "error"
                      ? "var(--concern)"
                      : s.state === "done"
                        ? "var(--ok)"
                        : "var(--ink-3)",
                }}
              >
                {s.state === "processing" ? "Reading…" : s.state === "done" ? "Added" : s.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusIcon({ state }: { state: FileStatus["state"] }) {
  if (state === "processing") {
    return (
      <span className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
    );
  }
  if (state === "done") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" className="flex-none">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--concern)" strokeWidth="2.5" className="flex-none">
      <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
    </svg>
  );
}
