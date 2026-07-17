import { BIOMARKERS, type Biomarker } from "./biomarkers";
import type { Direction, ExtractedReading, ExtractedReport, Reading, Report } from "./types";

/** Strip punctuation/whitespace and lowercase for tolerant matching. */
function canon(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop parenthetical asides like "(serum)"
    .replace(/[^a-z0-9µ%/^.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Precompute a synonym -> biomarker lookup once.
const SYNONYM_INDEX: Map<string, Biomarker> = (() => {
  const idx = new Map<string, Biomarker>();
  for (const marker of Object.values(BIOMARKERS)) {
    idx.set(canon(marker.displayName), marker);
    for (const syn of marker.synonyms) idx.set(canon(syn), marker);
  }
  return idx;
})();

/** Resolve a printed test name to a canonical biomarker, or null if unrecognized. */
export function matchBiomarker(testName: string): Biomarker | null {
  const key = canon(testName);
  if (!key) return null;
  const exact = SYNONYM_INDEX.get(key);
  if (exact) return exact;
  // Fall back to a contains-match against known synonyms, longest first so that
  // "ldl cholesterol" wins over "cholesterol".
  let best: Biomarker | null = null;
  let bestLen = 0;
  for (const [syn, marker] of SYNONYM_INDEX) {
    if ((key === syn || key.includes(syn) || syn.includes(key)) && syn.length > bestLen) {
      best = marker;
      bestLen = syn.length;
    }
  }
  return best;
}

const normUnit = (u: string): string => u.toLowerCase().replace(/\s+/g, "");

/** Convert a printed value+unit into the marker's canonical unit. Returns null if unconvertible. */
export function convertValue(marker: Biomarker, value: number, printedUnit: string | null): number | null {
  if (!Number.isFinite(value)) return null;
  if (!printedUnit) return value; // assume already canonical when no unit printed
  const key = normUnit(printedUnit);
  if (marker.nonLinear && marker.nonLinear[key]) return round(marker.nonLinear[key](value));
  const factor = marker.conversions[key];
  if (factor !== undefined) return round(value * factor);
  // Unknown unit: if it equals the canonical unit ignoring case/space, keep as-is.
  if (key === normUnit(marker.canonicalUnit)) return value;
  return null; // unrecognized unit — better to drop than to plot a wrong-scale point
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/**
 * Parse a printed reference-range string into low/high bounds in canonical units.
 * Handles "70 - 100", "< 200", "<=5.7", "> 40", "40-50 %", and unitful ranges.
 */
export function parseRange(
  marker: Biomarker,
  rangeText: string | null,
  printedUnit: string | null,
): { low: number | null; high: number | null } {
  if (!rangeText) return { low: null, high: null };
  const text = rangeText.replace(/,/g, "").trim();
  const nums = text.match(/-?\d+(?:\.\d+)?/g);
  const conv = (n: number) => convertValue(marker, n, printedUnit);

  if (/^[<≤]=?/.test(text) && nums?.length) {
    return { low: null, high: conv(parseFloat(nums[0])) };
  }
  if (/^[>≥]=?/.test(text) && nums?.length) {
    return { low: conv(parseFloat(nums[0])), high: null };
  }
  if (nums && nums.length >= 2) {
    const a = conv(parseFloat(nums[0]));
    const b = conv(parseFloat(nums[1]));
    if (a !== null && b !== null) return { low: Math.min(a, b), high: Math.max(a, b) };
    return { low: a, high: b };
  }
  return { low: null, high: null };
}

/** Determine high/low/normal against the effective range (report range preferred). */
export function deriveStatus(value: number, low: number | null, high: number | null): Direction {
  if (low === null && high === null) return "unknown";
  if (high !== null && value > high) return "high";
  if (low !== null && value < low) return "low";
  return "normal";
}

/** Normalize one extracted reading. Returns null if it can't be resolved to a marker/value. */
export function normalizeReading(raw: ExtractedReading): Reading | null {
  if (raw.value === null || !Number.isFinite(raw.value)) return null;
  const marker = matchBiomarker(raw.testName);
  if (!marker) return null;

  const value = convertValue(marker, raw.value, raw.unit);
  if (value === null) return null;

  const { low, high } = parseRange(marker, raw.referenceRange, raw.unit);
  // Prefer the report's own range; fall back to the population range only if absent.
  const refLow = low ?? marker.refLow;
  const refHigh = high ?? marker.refHigh;

  return {
    canonicalId: marker.id,
    value,
    unit: marker.canonicalUnit,
    printedValue: raw.value,
    printedUnit: raw.unit,
    refLow,
    refHigh,
    printedRefText: raw.referenceRange,
    status: deriveStatus(value, refLow, refHigh),
  };
}

/** Build a normalized Report from a raw extraction result. */
export function normalizeReport(
  raw: ExtractedReport,
  fileName: string,
  id: string,
): Report {
  const readings: Reading[] = [];
  const seen = new Set<string>();
  for (const r of raw.readings) {
    const n = normalizeReading(r);
    if (!n) continue;
    if (seen.has(n.canonicalId)) continue; // keep first occurrence of a marker per report
    seen.add(n.canonicalId);
    readings.push(n);
  }
  return {
    id,
    fileName,
    reportDate: raw.reportDateISO,
    printedDate: raw.reportDatePrinted,
    dateAmbiguous: raw.dateAmbiguous,
    labName: raw.labName,
    patientName: raw.patientName,
    country: raw.country,
    readings,
    uploadedAt: new Date().toISOString(),
  };
}
