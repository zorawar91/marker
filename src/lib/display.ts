import type { Direction, TrendState } from "./types";

export interface StateMeta {
  label: string;
  color: string; // CSS var for text/accent
  bg: string; // CSS var for chip background
  blurb: string; // neutral, non-diagnostic description
}

export const STATE_META: Record<TrendState, StateMeta> = {
  improving: {
    label: "Improving",
    color: "var(--improve)",
    bg: "var(--improve-bg)",
    blurb: "Moving in a favorable direction compared with your last report.",
  },
  stable: {
    label: "Stable",
    color: "var(--neutral)",
    bg: "var(--neutral-bg)",
    blurb: "Within range with no meaningful movement.",
  },
  watching: {
    label: "Watching",
    color: "var(--watch)",
    bg: "var(--watch-bg)",
    blurb: "Within range but drifting toward a boundary, or out of range and unchanged.",
  },
  concern: {
    label: "Worth a look",
    color: "var(--concern)",
    bg: "var(--concern-bg)",
    blurb: "Outside the reference range and moving further out, or a large recent change.",
  },
  single: {
    label: "First reading",
    color: "var(--neutral)",
    bg: "var(--neutral-bg)",
    blurb: "Only one report so far — upload another year to see a trend.",
  },
};

export interface DirectionMeta {
  label: string;
  color: string;
  bg: string;
}

export const DIRECTION_META: Record<Direction, DirectionMeta> = {
  normal: { label: "In range", color: "var(--ok)", bg: "var(--ok-bg)" },
  high: { label: "Above range", color: "var(--concern)", bg: "var(--concern-bg)" },
  low: { label: "Below range", color: "var(--watch)", bg: "var(--watch-bg)" },
  unknown: { label: "No range", color: "var(--neutral)", bg: "var(--neutral-bg)" },
};

export function formatValue(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, "");
}

export function formatDate(iso: string | null): string {
  if (!iso) return "Undated";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatMonthYear(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}
