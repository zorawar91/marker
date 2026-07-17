import type { Better, Panel } from "./types";

/**
 * A canonical biomarker definition.
 *
 * `synonyms` are matched (case-insensitively, punctuation-stripped) against the
 * test names labs print, so "Glycosylated Hemoglobin", "HbA1c", and "Glycated Hb"
 * all resolve to the same series (R2).
 *
 * Unit conversion is code, never LLM math (see normalize.ts). Each entry declares
 * one `canonicalUnit`; `conversions` maps a printed unit to a multiply-factor that
 * brings a printed value into the canonical unit. `nonLinear` markers (HbA1c) carry
 * an explicit function instead of a factor.
 *
 * `refLow`/`refHigh` are population fallbacks ONLY — used when a report prints no
 * range of its own. Marker prefers each report's own printed range (Q4).
 *
 * `explanation` is static, reviewed content (R5). It states what the marker measures
 * and what influences it — never a diagnosis or treatment.
 */
export interface Biomarker {
  id: string;
  displayName: string;
  panel: Panel;
  canonicalUnit: string;
  /** Printed-unit (lowercased, spaces stripped) -> factor to canonical unit. */
  conversions: Record<string, number>;
  /** For markers whose unit conversion is not a simple factor (e.g. HbA1c NGSP<->IFCC). */
  nonLinear?: Record<string, (v: number) => number>;
  better: Better;
  refLow: number | null;
  refHigh: number | null;
  synonyms: string[];
  explanation: string;
}

// Helper: identity conversion set for a marker with a single common unit.
const only = (unit: string): Record<string, number> => ({ [unit.toLowerCase().replace(/\s+/g, "")]: 1 });

export const BIOMARKERS: Record<string, Biomarker> = {
  // ---- Lipid profile ----
  total_cholesterol: {
    id: "total_cholesterol",
    displayName: "Total Cholesterol",
    panel: "lipids",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dl": 1, "mmol/l": 38.67 },
    better: "lower",
    refLow: null,
    refHigh: 200,
    synonyms: ["total cholesterol", "cholesterol total", "cholesterol, total", "s cholesterol"],
    explanation:
      "Total cholesterol is the overall amount of cholesterol in your blood, combining the LDL, HDL, and other fractions. On its own it is a rough summary; the individual fractions (LDL and HDL) tell you more. Diet, activity, weight, and genetics all influence it.",
  },
  ldl: {
    id: "ldl",
    displayName: "LDL Cholesterol",
    panel: "lipids",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dl": 1, "mmol/l": 38.67 },
    better: "lower",
    refLow: null,
    refHigh: 100,
    synonyms: ["ldl", "ldl cholesterol", "ldl-c", "ldl cholesterol calculated", "low density lipoprotein"],
    explanation:
      "LDL is often called 'bad' cholesterol because higher levels are associated with buildup in artery walls over time. It is one of the most tracked markers in a lipid profile. Diet, exercise, weight, and genetics influence it, and it tends to drift up gradually with age.",
  },
  hdl: {
    id: "hdl",
    displayName: "HDL Cholesterol",
    panel: "lipids",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dl": 1, "mmol/l": 38.67 },
    better: "higher",
    refLow: 40,
    refHigh: null,
    synonyms: ["hdl", "hdl cholesterol", "hdl-c", "high density lipoprotein"],
    explanation:
      "HDL is often called 'good' cholesterol because it helps carry cholesterol away from artery walls. Unlike most markers, higher HDL is generally considered favorable. Regular physical activity tends to raise it.",
  },
  triglycerides: {
    id: "triglycerides",
    displayName: "Triglycerides",
    panel: "lipids",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dl": 1, "mmol/l": 88.57 },
    better: "lower",
    refLow: null,
    refHigh: 150,
    synonyms: ["triglycerides", "tg", "trigly", "serum triglycerides"],
    explanation:
      "Triglycerides are a type of fat carried in the blood. Levels are strongly affected by recent meals, alcohol, refined carbohydrates, and body weight, so they can swing more than other lipids between tests. A fasting sample gives a cleaner reading.",
  },
  vldl: {
    id: "vldl",
    displayName: "VLDL Cholesterol",
    panel: "lipids",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dl": 1, "mmol/l": 38.67 },
    better: "lower",
    refLow: null,
    refHigh: 30,
    synonyms: ["vldl", "vldl cholesterol", "very low density lipoprotein"],
    explanation:
      "VLDL is a cholesterol fraction that mainly carries triglycerides. It is usually estimated from your triglyceride value rather than measured directly, and it moves together with triglycerides.",
  },

  // ---- Glucose / diabetes ----
  hba1c: {
    id: "hba1c",
    displayName: "HbA1c",
    panel: "glucose",
    canonicalUnit: "%",
    conversions: { "%": 1, percent: 1 },
    // IFCC (mmol/mol) -> NGSP (%) is a linear-but-non-factor relation.
    nonLinear: { "mmol/mol": (v: number) => v / 10.929 + 2.15 },
    better: "lower",
    refLow: null,
    refHigh: 5.7,
    synonyms: ["hba1c", "hb a1c", "glycosylated hemoglobin", "glycated hemoglobin", "glycated hb", "a1c", "hemoglobin a1c"],
    explanation:
      "HbA1c reflects your average blood sugar over roughly the past three months, so it is more stable than a single glucose reading. It is one of the main markers used to understand long-term blood-sugar control. Diet and activity influence it gradually over weeks.",
  },
  glucose_fasting: {
    id: "glucose_fasting",
    displayName: "Fasting Glucose",
    panel: "glucose",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dl": 1, "mmol/l": 18.0 },
    better: "in-range",
    refLow: 70,
    refHigh: 100,
    synonyms: ["fasting glucose", "glucose fasting", "fasting blood sugar", "fbs", "glucose, fasting", "blood sugar fasting"],
    explanation:
      "Fasting glucose is your blood-sugar level after not eating for several hours. Because it is a single snapshot, it can be affected by how long you fasted, stress, and sleep. HbA1c gives a longer-term picture alongside it.",
  },

  // ---- Thyroid ----
  tsh: {
    id: "tsh",
    displayName: "TSH",
    panel: "thyroid",
    canonicalUnit: "uIU/mL",
    conversions: { "uiu/ml": 1, "µiu/ml": 1, "miu/l": 1, "µu/ml": 1, "uu/ml": 1 },
    better: "in-range",
    refLow: 0.4,
    refHigh: 4.0,
    synonyms: ["tsh", "thyroid stimulating hormone", "thyrotropin", "s tsh", "tsh ultrasensitive"],
    explanation:
      "TSH is a signal from the brain that tells the thyroid gland how much thyroid hormone to make. It is the most common first-line thyroid marker. Both high and low values are outside the usual range, so this marker is read against a band rather than a single ceiling.",
  },
  t3: {
    id: "t3",
    displayName: "Total T3",
    panel: "thyroid",
    canonicalUnit: "ng/dL",
    conversions: { "ng/dl": 1, "nmol/l": 65.1 },
    better: "in-range",
    refLow: 80,
    refHigh: 200,
    synonyms: ["t3", "total t3", "triiodothyronine", "t3 total"],
    explanation:
      "T3 is one of the two main thyroid hormones. It is usually interpreted together with T4 and TSH rather than alone, as the three give a fuller picture of thyroid activity.",
  },
  t4: {
    id: "t4",
    displayName: "Total T4",
    panel: "thyroid",
    canonicalUnit: "ug/dL",
    conversions: { "ug/dl": 1, "µg/dl": 1, "nmol/l": 12.87 },
    better: "in-range",
    refLow: 4.5,
    refHigh: 12.0,
    synonyms: ["t4", "total t4", "thyroxine", "t4 total"],
    explanation:
      "T4 (thyroxine) is the main hormone the thyroid produces, later converted into the more active T3. It is read together with TSH and T3 to understand overall thyroid function.",
  },
  free_t4: {
    id: "free_t4",
    displayName: "Free T4",
    panel: "thyroid",
    canonicalUnit: "ng/dL",
    conversions: { "ng/dl": 1, "pmol/l": 0.0777 },
    better: "in-range",
    refLow: 0.8,
    refHigh: 1.8,
    synonyms: ["free t4", "ft4", "free thyroxine"],
    explanation:
      "Free T4 measures the portion of thyroid hormone that is unbound and available for your body to use. It is often more informative than total T4 and is read alongside TSH.",
  },

  // ---- Complete blood count (CBC) ----
  hemoglobin: {
    id: "hemoglobin",
    displayName: "Hemoglobin",
    panel: "cbc",
    canonicalUnit: "g/dL",
    conversions: { "g/dl": 1, "g/l": 0.1 },
    better: "in-range",
    refLow: 13,
    refHigh: 17,
    synonyms: ["hemoglobin", "haemoglobin", "hb", "hgb"],
    explanation:
      "Hemoglobin is the protein in red blood cells that carries oxygen. Low values are associated with anemia and can cause tiredness; the usual range differs between men and women. Your report's own range is the best reference for your reading.",
  },
  hematocrit: {
    id: "hematocrit",
    displayName: "Hematocrit",
    panel: "cbc",
    canonicalUnit: "%",
    conversions: { "%": 1, percent: 1, "l/l": 100 },
    better: "in-range",
    refLow: 40,
    refHigh: 50,
    synonyms: ["hematocrit", "haematocrit", "hct", "pcv", "packed cell volume"],
    explanation:
      "Hematocrit is the proportion of your blood made up of red blood cells. It moves together with hemoglobin and helps describe whether you have too few or too many red cells.",
  },
  wbc: {
    id: "wbc",
    displayName: "White Blood Cells",
    panel: "cbc",
    canonicalUnit: "10^3/uL",
    conversions: { "10^3/ul": 1, "10³/µl": 1, "thou/ul": 1, "k/ul": 1, "cells/cumm": 0.001, "/cumm": 0.001, "10^9/l": 1 },
    better: "in-range",
    refLow: 4,
    refHigh: 11,
    synonyms: ["wbc", "white blood cell", "white blood cells", "total leukocyte count", "tlc", "leukocytes", "wbc count"],
    explanation:
      "White blood cells are part of your immune system. Counts commonly rise temporarily during infections and can vary day to day, so a single out-of-range value is read in context of how you feel and other markers.",
  },
  platelets: {
    id: "platelets",
    displayName: "Platelets",
    panel: "cbc",
    canonicalUnit: "10^3/uL",
    conversions: { "10^3/ul": 1, "10³/µl": 1, "thou/ul": 1, "k/ul": 1, "lakhs/cumm": 100, "cells/cumm": 0.001, "/cumm": 0.001, "10^9/l": 1 },
    better: "in-range",
    refLow: 150,
    refHigh: 410,
    synonyms: ["platelets", "platelet count", "plt", "thrombocytes"],
    explanation:
      "Platelets are cell fragments that help blood clot. Both low and high counts sit outside the usual range. Values can shift with infection, inflammation, or recent illness.",
  },
  rbc: {
    id: "rbc",
    displayName: "Red Blood Cells",
    panel: "cbc",
    canonicalUnit: "10^6/uL",
    conversions: { "10^6/ul": 1, "10⁶/µl": 1, "mill/ul": 1, "million/ul": 1, "10^12/l": 1 },
    better: "in-range",
    refLow: 4.5,
    refHigh: 5.9,
    synonyms: ["rbc", "red blood cell", "red blood cells", "rbc count", "erythrocytes", "total rbc count"],
    explanation:
      "Red blood cells carry oxygen through your body. The count is interpreted together with hemoglobin and hematocrit to understand your oxygen-carrying capacity.",
  },

  // ---- Liver function (LFT) ----
  alt: {
    id: "alt",
    displayName: "ALT (SGPT)",
    panel: "liver",
    canonicalUnit: "U/L",
    conversions: only("U/L"),
    better: "in-range",
    refLow: null,
    refHigh: 40,
    synonyms: ["alt", "sgpt", "alanine aminotransferase", "alt (sgpt)", "sgpt (alt)"],
    explanation:
      "ALT is an enzyme found mainly in the liver. Higher levels can reflect the liver being under strain from many causes, including diet, alcohol, medications, or fatty liver. It is read together with other liver markers.",
  },
  ast: {
    id: "ast",
    displayName: "AST (SGOT)",
    panel: "liver",
    canonicalUnit: "U/L",
    conversions: only("U/L"),
    better: "in-range",
    refLow: null,
    refHigh: 40,
    synonyms: ["ast", "sgot", "aspartate aminotransferase", "ast (sgot)", "sgot (ast)"],
    explanation:
      "AST is an enzyme present in the liver and also in muscle. Because it is not liver-specific, it is interpreted alongside ALT and other liver markers rather than on its own.",
  },
  alp: {
    id: "alp",
    displayName: "Alkaline Phosphatase",
    panel: "liver",
    canonicalUnit: "U/L",
    conversions: only("U/L"),
    better: "in-range",
    refLow: 30,
    refHigh: 120,
    synonyms: ["alp", "alkaline phosphatase", "alk phos", "s alkaline phosphatase"],
    explanation:
      "Alkaline phosphatase is an enzyme found in the liver and bones. Its usual range is wider in growing children and can shift with bone as well as liver activity, so it is read in context.",
  },
  bilirubin_total: {
    id: "bilirubin_total",
    displayName: "Total Bilirubin",
    panel: "liver",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dl": 1, "umol/l": 0.0585, "µmol/l": 0.0585 },
    better: "in-range",
    refLow: null,
    refHigh: 1.2,
    synonyms: ["bilirubin total", "total bilirubin", "bilirubin, total", "t bilirubin", "s bilirubin total"],
    explanation:
      "Bilirubin is a yellow substance produced when red blood cells are recycled; the liver clears it. Mildly higher values are common and can be harmless in some people, but it is read together with the other liver markers.",
  },
  albumin: {
    id: "albumin",
    displayName: "Albumin",
    panel: "liver",
    canonicalUnit: "g/dL",
    conversions: { "g/dl": 1, "g/l": 0.1 },
    better: "in-range",
    refLow: 3.5,
    refHigh: 5.2,
    synonyms: ["albumin", "s albumin", "serum albumin"],
    explanation:
      "Albumin is the main protein made by the liver and carried in blood. It reflects both liver function and overall nutrition, and is interpreted alongside other liver and protein markers.",
  },

  // ---- Kidney function (KFT) ----
  creatinine: {
    id: "creatinine",
    displayName: "Creatinine",
    panel: "kidney",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dl": 1, "umol/l": 0.0113, "µmol/l": 0.0113 },
    better: "in-range",
    refLow: 0.6,
    refHigh: 1.3,
    synonyms: ["creatinine", "s creatinine", "serum creatinine", "creatinine serum"],
    explanation:
      "Creatinine is a waste product from normal muscle activity that the kidneys filter out. It is one of the main markers used to gauge kidney function, and values are influenced by muscle mass and hydration.",
  },
  urea: {
    id: "urea",
    displayName: "Blood Urea",
    panel: "kidney",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dl": 1, "mmol/l": 6.006 },
    better: "in-range",
    refLow: 15,
    refHigh: 45,
    synonyms: ["urea", "blood urea", "serum urea", "s urea"],
    explanation:
      "Urea is a waste product from protein breakdown that the kidneys clear. Levels are affected by hydration and diet as well as kidney function, so it is read together with creatinine.",
  },
  bun: {
    id: "bun",
    displayName: "Blood Urea Nitrogen",
    panel: "kidney",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dl": 1, "mmol/l": 2.801 },
    better: "in-range",
    refLow: 7,
    refHigh: 20,
    synonyms: ["bun", "blood urea nitrogen", "urea nitrogen"],
    explanation:
      "Blood urea nitrogen (BUN) measures the nitrogen portion of urea, a protein waste product cleared by the kidneys. It is closely related to blood urea and read alongside creatinine.",
  },
  uric_acid: {
    id: "uric_acid",
    displayName: "Uric Acid",
    panel: "kidney",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dl": 1, "umol/l": 0.0168, "µmol/l": 0.0168 },
    better: "in-range",
    refLow: 3.5,
    refHigh: 7.2,
    synonyms: ["uric acid", "s uric acid", "serum uric acid"],
    explanation:
      "Uric acid is a waste product from the breakdown of certain foods and body processes. Higher levels are associated with gout in some people. Diet, hydration, and genetics influence it.",
  },
  egfr: {
    id: "egfr",
    displayName: "eGFR",
    panel: "kidney",
    canonicalUnit: "mL/min/1.73m2",
    conversions: { "ml/min/1.73m2": 1, "ml/min/1.73m²": 1, "ml/min": 1 },
    better: "higher",
    refLow: 90,
    refHigh: null,
    synonyms: ["egfr", "estimated gfr", "gfr", "estimated glomerular filtration rate"],
    explanation:
      "eGFR is an estimate of how well your kidneys are filtering, calculated from creatinine along with age and other factors. Higher values are generally more favorable. It is an estimate, so it is read as a trend rather than a precise number.",
  },

  // ---- Vitamins ----
  vitamin_d: {
    id: "vitamin_d",
    displayName: "Vitamin D (25-OH)",
    panel: "vitamins",
    canonicalUnit: "ng/mL",
    conversions: { "ng/ml": 1, "nmol/l": 0.4006 },
    better: "in-range",
    refLow: 30,
    refHigh: 100,
    synonyms: ["vitamin d", "25 oh vitamin d", "25-hydroxy vitamin d", "vitamin d 25 hydroxy", "vit d", "25(oh)d", "vitamin d total"],
    explanation:
      "Vitamin D supports bone health and other body processes. Levels depend heavily on sun exposure, diet, and supplements, and are commonly low in people who spend most of their time indoors. It is often tracked to guide supplementation.",
  },
  vitamin_b12: {
    id: "vitamin_b12",
    displayName: "Vitamin B12",
    panel: "vitamins",
    canonicalUnit: "pg/mL",
    conversions: { "pg/ml": 1, "pmol/l": 1.355 },
    better: "in-range",
    refLow: 200,
    refHigh: 900,
    synonyms: ["vitamin b12", "b12", "cobalamin", "vit b12", "vitamin b-12"],
    explanation:
      "Vitamin B12 supports nerve function and red blood cell production. Levels depend on diet and absorption, and can be low in people who eat little animal produce. It is commonly tracked to guide supplementation.",
  },
};

/** Ordered panel metadata for grouping the dashboard. */
export const PANELS: Array<{ id: Panel; label: string }> = [
  { id: "lipids", label: "Lipid Profile" },
  { id: "glucose", label: "Blood Sugar" },
  { id: "thyroid", label: "Thyroid" },
  { id: "cbc", label: "Complete Blood Count" },
  { id: "liver", label: "Liver Function" },
  { id: "kidney", label: "Kidney Function" },
  { id: "vitamins", label: "Vitamins" },
  { id: "other", label: "Other" },
];

export function panelLabel(panel: Panel): string {
  return PANELS.find((p) => p.id === panel)?.label ?? "Other";
}
