import { normalizeReport } from "./normalize";
import type { ExtractedReport, Report } from "./types";

// Synthetic sample reports (R8): 3 years, realistic Indian lab formatting, built
// to tell a clear story on first load — LDL rising into "concern", HbA1c drifting
// ("watching"), Vitamin D recovering ("improving"), most else stable. These run
// through the real normalization pipeline so the sample flow exercises the same
// code path as a live upload. No real person's data.

function raw(
  date: string,
  iso: string,
  lab: string,
  readings: ExtractedReport["readings"],
): ExtractedReport {
  return {
    isLabReport: true,
    rejectionReason: null,
    reportDatePrinted: date,
    reportDateISO: iso,
    dateAmbiguous: false,
    labName: lab,
    patientName: "Sample Patient",
    country: "India",
    readings,
  };
}

const report2023 = raw("15/03/2023", "2023-03-15", "Thyrocare", [
  { testName: "Total Cholesterol", value: 185, unit: "mg/dL", referenceRange: "< 200" },
  { testName: "LDL Cholesterol", value: 110, unit: "mg/dL", referenceRange: "< 100" },
  { testName: "HDL Cholesterol", value: 48, unit: "mg/dL", referenceRange: "> 40" },
  { testName: "Triglycerides", value: 120, unit: "mg/dL", referenceRange: "< 150" },
  { testName: "HbA1c", value: 5.4, unit: "%", referenceRange: "4.0 - 5.6" },
  { testName: "Fasting Glucose", value: 92, unit: "mg/dL", referenceRange: "70 - 100" },
  { testName: "TSH", value: 2.1, unit: "µIU/mL", referenceRange: "0.4 - 4.0" },
  { testName: "Vitamin D (25-OH)", value: 18, unit: "ng/mL", referenceRange: "30 - 100" },
  { testName: "Vitamin B12", value: 320, unit: "pg/mL", referenceRange: "200 - 900" },
  { testName: "Hemoglobin", value: 14.6, unit: "g/dL", referenceRange: "13 - 17" },
  { testName: "Creatinine", value: 0.9, unit: "mg/dL", referenceRange: "0.6 - 1.3" },
  { testName: "SGPT (ALT)", value: 28, unit: "U/L", referenceRange: "< 40" },
]);

const report2024 = raw("22/06/2024", "2024-06-22", "Dr Lal PathLabs", [
  { testName: "Total Cholesterol", value: 198, unit: "mg/dL", referenceRange: "< 200" },
  { testName: "LDL Cholesterol", value: 124, unit: "mg/dL", referenceRange: "< 100" },
  { testName: "HDL Cholesterol", value: 46, unit: "mg/dL", referenceRange: "> 40" },
  { testName: "Triglycerides", value: 138, unit: "mg/dL", referenceRange: "< 150" },
  { testName: "Glycosylated Hemoglobin", value: 5.6, unit: "%", referenceRange: "4.0 - 5.6" },
  { testName: "Fasting Blood Sugar", value: 97, unit: "mg/dL", referenceRange: "70 - 100" },
  { testName: "TSH", value: 2.4, unit: "µIU/mL", referenceRange: "0.4 - 4.0" },
  { testName: "25-Hydroxy Vitamin D", value: 26, unit: "ng/mL", referenceRange: "30 - 100" },
  { testName: "Vitamin B12", value: 410, unit: "pg/mL", referenceRange: "200 - 900" },
  { testName: "Hemoglobin", value: 14.8, unit: "g/dL", referenceRange: "13 - 17" },
  { testName: "Creatinine", value: 0.95, unit: "mg/dL", referenceRange: "0.6 - 1.3" },
  { testName: "SGPT (ALT)", value: 34, unit: "U/L", referenceRange: "< 40" },
]);

const report2026 = raw("10/01/2026", "2026-01-10", "Redcliffe Labs", [
  { testName: "Total Cholesterol", value: 214, unit: "mg/dL", referenceRange: "< 200" },
  { testName: "LDL Cholesterol", value: 138, unit: "mg/dL", referenceRange: "< 100" },
  { testName: "HDL Cholesterol", value: 47, unit: "mg/dL", referenceRange: "> 40" },
  { testName: "Triglycerides", value: 152, unit: "mg/dL", referenceRange: "< 150" },
  { testName: "HbA1c", value: 5.8, unit: "%", referenceRange: "4.0 - 5.6" },
  { testName: "Fasting Glucose", value: 99, unit: "mg/dL", referenceRange: "70 - 100" },
  { testName: "TSH", value: 2.2, unit: "µIU/mL", referenceRange: "0.4 - 4.0" },
  { testName: "Vitamin D Total", value: 41, unit: "ng/mL", referenceRange: "30 - 100" },
  { testName: "Vitamin B12", value: 505, unit: "pg/mL", referenceRange: "200 - 900" },
  { testName: "Hemoglobin", value: 15.0, unit: "g/dL", referenceRange: "13 - 17" },
  { testName: "Creatinine", value: 0.98, unit: "mg/dL", referenceRange: "0.6 - 1.3" },
  { testName: "SGPT (ALT)", value: 41, unit: "U/L", referenceRange: "< 40" },
]);

export function sampleReports(): Report[] {
  return [
    normalizeReport(report2023, "Thyrocare_Mar2023.pdf", "sample-2023"),
    normalizeReport(report2024, "DrLal_Jun2024.pdf", "sample-2024"),
    normalizeReport(report2026, "Redcliffe_Jan2026.pdf", "sample-2026"),
  ];
}
