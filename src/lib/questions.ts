import { BIOMARKERS } from "./biomarkers";
import type { DoctorQuestion, Series } from "./types";

/**
 * Generate "questions to ask your doctor" (R6).
 *
 * Deliberately TEMPLATE-based, not LLM-generated: the user's actual values and
 * trends are slotted into reviewed question templates, so the entire medical-
 * language surface stays static and auditable (same principle as R5). Every
 * output is phrased as a question to ask — never a conclusion or a diagnosis.
 */

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function generateQuestions(series: Series[]): DoctorQuestion[] {
  const questions: DoctorQuestion[] = [];

  for (const s of series) {
    const marker = BIOMARKERS[s.canonicalId];
    if (!marker) continue;
    const name = marker.displayName;
    const first = s.points[0];
    const last = s.points[s.points.length - 1];

    if (s.state === "concern") {
      if (s.points.length >= 2 && first.value !== last.value) {
        questions.push({
          canonicalId: s.canonicalId,
          text: `My ${name} has moved from ${fmt(first.value)} to ${fmt(last.value)} ${marker.canonicalUnit} and is now outside the reference range — should we discuss this trend?`,
        });
      } else {
        questions.push({
          canonicalId: s.canonicalId,
          text: `My latest ${name} is ${fmt(last.value)} ${marker.canonicalUnit}, outside the reference range — is this something we should look into?`,
        });
      }
    } else if (s.state === "watching") {
      questions.push({
        canonicalId: s.canonicalId,
        text: `My ${name} is within range but appears to be drifting (${s.evidence}) — is there anything I should do to keep it in a healthy range?`,
      });
    } else if (s.state === "improving") {
      questions.push({
        canonicalId: s.canonicalId,
        text: `My ${name} has been moving in a better direction (${s.evidence}) — is my current approach working, and should I keep it up?`,
      });
    }
  }

  // Rank: concern first, then watching, then improving — cap at 7 (R6).
  const priority: Record<string, number> = { concern: 0, watching: 1, improving: 2 };
  const stateOf = (q: DoctorQuestion) =>
    series.find((s) => s.canonicalId === q.canonicalId)?.state ?? "stable";
  questions.sort((a, b) => (priority[stateOf(a)] ?? 3) - (priority[stateOf(b)] ?? 3));

  const top = questions.slice(0, 7);

  // No flags: return a sensible generic checkup list, not an empty state (R6).
  if (top.length === 0) {
    return [
      { canonicalId: null, text: "Are all of my results in a healthy range for someone my age and health history?" },
      { canonicalId: null, text: "Are there any markers I should keep a closer eye on going forward?" },
      { canonicalId: null, text: "How often should I repeat these tests to track my trends?" },
      { canonicalId: null, text: "Are there lifestyle changes that would help keep these numbers where they are?" },
    ];
  }

  // Always close with a general framing question.
  top.push({ canonicalId: null, text: "How often should I repeat these tests to keep tracking my trends?" });
  return top;
}
