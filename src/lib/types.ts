// Core domain types for Marker.
// The data model is deliberately serializable end-to-end so that today's
// localStorage state can move to a backend later (PRD P2) without a rewrite.

export type Panel =
  | "lipids"
  | "glucose"
  | "thyroid"
  | "cbc"
  | "liver"
  | "kidney"
  | "vitamins"
  | "other";

export type Direction = "high" | "low" | "normal" | "unknown";

/** Which way is clinically favorable for a marker. Drives trend classification. */
export type Better = "lower" | "higher" | "in-range";

/**
 * A single biomarker reading as extracted from one report, after normalization.
 * `value` and `unit` are always in the marker's canonical unit; `printed*`
 * fields preserve what the lab actually showed for traceability (R2).
 */
export interface Reading {
  canonicalId: string; // key into BIOMARKERS; e.g. "ldl"
  value: number; // in canonical unit
  unit: string; // canonical unit label
  printedValue: number | null; // value exactly as printed on the report
  printedUnit: string | null; // unit exactly as printed
  // Reference range for THIS reading, from the report itself (per-report ranges, R3/Q4).
  refLow: number | null; // in canonical unit
  refHigh: number | null; // in canonical unit
  printedRefText: string | null; // range exactly as printed
  status: Direction;
}

/** One uploaded lab report after extraction. */
export interface Report {
  id: string;
  fileName: string;
  reportDate: string | null; // ISO 8601 (YYYY-MM-DD), inferred from content
  printedDate: string | null; // date string exactly as printed
  dateAmbiguous: boolean; // true when DD/MM vs MM/DD could not be resolved
  labName: string | null;
  patientName: string | null;
  country: string | null; // inferred, used for date disambiguation
  readings: Reading[];
  uploadedAt: string; // ISO timestamp of upload
}

/** Raw shape returned by the extraction API, before normalization. */
export interface ExtractedReading {
  testName: string;
  value: number | null;
  unit: string | null;
  referenceRange: string | null;
}

export interface ExtractedReport {
  isLabReport: boolean;
  rejectionReason: string | null;
  reportDatePrinted: string | null;
  reportDateISO: string | null;
  dateAmbiguous: boolean;
  labName: string | null;
  patientName: string | null;
  country: string | null;
  readings: ExtractedReading[];
}

export type TrendState = "improving" | "stable" | "watching" | "concern" | "single";

/** A biomarker's full history across all uploaded reports, plus its trend verdict. */
export interface Series {
  canonicalId: string;
  points: Array<{
    reportId: string;
    date: string | null;
    value: number;
    refLow: number | null;
    refHigh: number | null;
    status: Direction;
  }>;
  state: TrendState;
  evidence: string; // human-readable justification, e.g. "110 → 138, up 25%"
  latest: Reading | null;
  latestDate: string | null;
}

export interface DoctorQuestion {
  canonicalId: string | null;
  text: string;
}
