import type { Report } from "./types";

// v1 is session-based with local persistence (R7). The data model is kept
// serializable so this can later move to a backend (P2) unchanged.
const KEY = "marker.reports.v1";

export function loadReports(): Report[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Report[]) : [];
  } catch {
    return [];
  }
}

export function saveReports(reports: Report[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(reports));
  } catch {
    // localStorage full or unavailable — fail silently; in-memory state still works.
  }
}

export function clearReports(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
