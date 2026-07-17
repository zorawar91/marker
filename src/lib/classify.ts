import { BIOMARKERS } from "./biomarkers";
import type { Reading, Report, Series, TrendState } from "./types";

/** Percentage change from a to b, guarding divide-by-zero. */
function pctChange(a: number, b: number): number {
  if (a === 0) return b === 0 ? 0 : 100;
  return ((b - a) / Math.abs(a)) * 100;
}

/** Sort reports oldest -> newest; undated reports sort last by upload time. */
export function sortReports(reports: Report[]): Report[] {
  return [...reports].sort((x, y) => {
    if (x.reportDate && y.reportDate) return x.reportDate.localeCompare(y.reportDate);
    if (x.reportDate) return -1;
    if (y.reportDate) return 1;
    return x.uploadedAt.localeCompare(y.uploadedAt);
  });
}

/**
 * Is a value inside its reference range? Markers with only one bound count the
 * open side as in-range.
 */
function inRange(r: { value: number; refLow: number | null; refHigh: number | null }): boolean {
  if (r.refHigh !== null && r.value > r.refHigh) return false;
  if (r.refLow !== null && r.value < r.refLow) return false;
  return true;
}

/** How far outside range a value sits, as a fraction of the nearer bound. 0 = in range. */
function outOfRangeMagnitude(r: { value: number; refLow: number | null; refHigh: number | null }): number {
  if (r.refHigh !== null && r.value > r.refHigh && r.refHigh !== 0) return (r.value - r.refHigh) / Math.abs(r.refHigh);
  if (r.refLow !== null && r.value < r.refLow && r.refLow !== 0) return (r.refLow - r.value) / Math.abs(r.refLow);
  return 0;
}

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Classify a marker's trajectory into improving / stable / watching / concern
 * (R4), adopted from ajit-singh-labs' "Clinical Watch". Language stays neutral
 * and names no disease. Irregular time intervals are a known v1 simplification —
 * the evidence string always shows the dates so the reader sees the time base.
 */
export function buildSeries(canonicalId: string, sortedReports: Report[]): Series | null {
  const marker = BIOMARKERS[canonicalId];
  if (!marker) return null;

  const points = sortedReports
    .map((rep) => {
      const reading = rep.readings.find((r) => r.canonicalId === canonicalId);
      if (!reading) return null;
      return {
        reportId: rep.id,
        date: rep.reportDate,
        value: reading.value,
        refLow: reading.refLow,
        refHigh: reading.refHigh,
        status: reading.status,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (points.length === 0) return null;

  const latestReport = [...sortedReports].reverse().find((rep) => rep.readings.some((r) => r.canonicalId === canonicalId)) ?? null;
  const latest: Reading | null = latestReport?.readings.find((r) => r.canonicalId === canonicalId) ?? null;
  const latestDate = latestReport?.reportDate ?? null;

  const last = points[points.length - 1];

  // Single data point: no trend yet.
  if (points.length === 1) {
    return {
      canonicalId,
      points,
      state: "single",
      evidence: `${fmt(last.value)} ${marker.canonicalUnit}${inRange(last) ? ", within range" : ", outside range"}`,
      latest,
      latestDate,
    };
  }

  const prev = points[points.length - 2];
  const change = pctChange(prev.value, last.value);
  const lastIn = inRange(last);
  const prevIn = inRange(prev);
  const lastMag = outOfRangeMagnitude(last);
  const prevMag = outOfRangeMagnitude(prev);

  // "Toward" range means moving in the clinically favorable direction.
  const movingTowardRange = !lastIn && lastMag < prevMag - 0.01;
  const movingAwayFromRange = !lastIn && lastMag > prevMag + 0.01;

  // Direction of change relative to what's favorable for this marker.
  let favorableMove: boolean;
  if (marker.better === "lower") favorableMove = change < 0;
  else if (marker.better === "higher") favorableMove = change > 0;
  else favorableMove = movingTowardRange || (lastIn && Math.abs(change) < 10);

  let state: TrendState;
  const MEANINGFUL = 10; // percent

  if (!prevIn && lastIn) {
    state = "improving"; // came back into range
  } else if (!lastIn && (movingTowardRange || (favorableMove && Math.abs(change) >= MEANINGFUL))) {
    state = "improving"; // out of range but meaningfully recovering
  } else if (!lastIn && (movingAwayFromRange || Math.abs(change) >= MEANINGFUL)) {
    state = "concern"; // out of range and worsening or a large jump
  } else if (!lastIn) {
    state = "watching"; // out of range but roughly unchanged
  } else if (driftingTowardBoundary(points, marker.better)) {
    state = "watching"; // in range but trending toward a boundary
  } else {
    state = "stable";
  }

  const dir = change > 0 ? "up" : change < 0 ? "down" : "unchanged";
  const dateFrom = prev.date ?? "earlier report";
  const dateTo = last.date ?? "latest report";
  const rangeText = last.refHigh !== null && last.refLow !== null
    ? `range ${fmt(last.refLow)}–${fmt(last.refHigh)}`
    : last.refHigh !== null
      ? `range up to ${fmt(last.refHigh)}`
      : last.refLow !== null
        ? `range above ${fmt(last.refLow)}`
        : "no printed range";
  const evidence =
    dir === "unchanged"
      ? `${fmt(last.value)} ${marker.canonicalUnit}, unchanged since ${dateFrom} (${rangeText})`
      : `${fmt(prev.value)} → ${fmt(last.value)} ${marker.canonicalUnit}, ${dir} ${Math.abs(Math.round(change))}% from ${dateFrom} to ${dateTo} (${rangeText})`;

  return { canonicalId, points, state, evidence, latest, latestDate };
}

/** In-range but drifting toward the nearer bound across the last few readings. */
function driftingTowardBoundary(
  points: Array<{ value: number; refLow: number | null; refHigh: number | null }>,
  better: string,
): boolean {
  const last = points[points.length - 1];
  if (!inRange(last)) return false;
  const first = points[0];
  const span = points.length >= 3 ? pctChange(points[points.length - 3].value, last.value) : pctChange(first.value, last.value);
  if (Math.abs(span) < 12) return false;

  // Distance to the bound we're heading toward, as a fraction of the range width.
  if (last.refHigh !== null && span > 0 && better !== "higher") {
    const width = last.refHigh - (last.refLow ?? 0);
    if (width > 0 && (last.refHigh - last.value) / width < 0.2) return true;
  }
  if (last.refLow !== null && span < 0 && better !== "lower") {
    const width = (last.refHigh ?? last.refLow * 2) - last.refLow;
    if (width > 0 && (last.value - last.refLow) / width < 0.2) return true;
  }
  return false;
}

/** Build a series for every marker present in any report. */
export function buildAllSeries(reports: Report[]): Series[] {
  const sorted = sortReports(reports);
  const ids = new Set<string>();
  for (const rep of sorted) for (const r of rep.readings) ids.add(r.canonicalId);
  return [...ids]
    .map((id) => buildSeries(id, sorted))
    .filter((s): s is Series => s !== null);
}

/**
 * "Notable values" tier: a reading more than 2x the upper limit or less than
 * half the lower limit, surfaced as a top-of-page alert (R4 severity tier).
 */
export function isNotable(reading: Reading): boolean {
  if (reading.refHigh !== null && reading.refHigh > 0 && reading.value > reading.refHigh * 2) return true;
  if (reading.refLow !== null && reading.refLow > 0 && reading.value < reading.refLow * 0.5) return true;
  return false;
}
