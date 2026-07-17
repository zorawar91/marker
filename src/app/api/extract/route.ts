import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Extraction runs server-side so the API key is never exposed to the client (Q2).
// The uploaded PDF is streamed to Claude and never written to disk (R7 privacy).

const MODEL = "claude-opus-4-8";
const MAX_PDF_BYTES = 25 * 1024 * 1024; // stay under the 32MB request ceiling

const SYSTEM_PROMPT = `You are a careful medical-lab-report data extractor. You extract structured data from blood and urine panel lab report PDFs from any lab, in India or abroad. You never interpret, diagnose, or advise — you only transcribe what is printed.

Rules:
- Extract EVERY biomarker/test row you can find: the test name, its numeric value, its unit, and its printed reference range, all exactly as printed.
- Use the value and unit exactly as they appear on the page. Do NOT convert units. Do NOT compute or infer values.
- If a value is qualitative (e.g. "Negative", "Nil") or absent, set value to null.
- reference range: copy the printed range string verbatim (e.g. "70 - 100", "< 200", "0.4-4.0"). null if none is printed.
- report date: find the collection or report date printed in the document (NOT today's date, NOT the printing timestamp if a collection date exists). Return it three ways: reportDatePrinted (verbatim), reportDateISO (YYYY-MM-DD), and dateAmbiguous.
  - Indian labs print DD/MM/YYYY; US labs print MM/DD/YYYY. Infer the country from the lab name, address, phone format, or units, and use it to resolve the date.
  - If the day/month order genuinely cannot be resolved (e.g. "03/04/2025" with no country signal), set dateAmbiguous true and make your best guess for reportDateISO.
- country: your best inference of the lab's country ("India", "United States", "United Kingdom", etc.), or null.
- patientName: the patient's name if printed, else null.
- labName: the laboratory/diagnostic company name, else null.
- isLabReport: true only if this is genuinely a blood/urine lab report. If it is a scanned image with no readable text, a password-protected/unreadable document, an invoice, prescription, or any non-lab document, set isLabReport false and give a short human-readable rejectionReason naming what it appears to be.`;

// JSON-schema for structured output. Nullable fields use anyOf; every object
// sets additionalProperties:false and lists all properties as required.
const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    isLabReport: { type: "boolean" },
    rejectionReason: nullable("string"),
    reportDatePrinted: nullable("string"),
    reportDateISO: nullable("string"),
    dateAmbiguous: { type: "boolean" },
    labName: nullable("string"),
    patientName: nullable("string"),
    country: nullable("string"),
    readings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          testName: { type: "string" },
          value: nullable("number"),
          unit: nullable("string"),
          referenceRange: nullable("string"),
        },
        required: ["testName", "value", "unit", "referenceRange"],
      },
    },
  },
  required: [
    "isLabReport",
    "rejectionReason",
    "reportDatePrinted",
    "reportDateISO",
    "dateAmbiguous",
    "labName",
    "patientName",
    "country",
    "readings",
  ],
} as const;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local to enable extraction." },
      { status: 500 },
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded file." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json(
      { error: `"${file.name}" is not a PDF. Marker reads text-based PDF lab reports.` },
      { status: 400 },
    );
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: `"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is 25 MB.` },
      { status: 400 },
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: "Extract every biomarker from this lab report following your rules. Return only the structured JSON.",
            },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: `"${file.name}" could not be processed.` },
        { status: 422 },
      );
    }

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: `Extraction returned no data for "${file.name}".` }, { status: 502 });
    }

    const parsed = JSON.parse(textBlock.text);
    return NextResponse.json({ extracted: parsed, fileName: file.name });
  } catch (err) {
    const isApi = err instanceof Anthropic.APIError;
    const status = isApi ? err.status ?? 502 : 502;
    const detail = isApi && typeof err.message === "string" ? err.message : String(err);
    const requestId = isApi ? err.requestID : undefined;

    // Log the full error to the dev server terminal for diagnosis.
    console.error(`[extract] "${file.name}" failed:`, { status, requestId, detail });

    // Map to a specific, human-readable client message.
    let msg: string;
    if (/credit balance|billing|purchase credits/i.test(detail)) {
      msg = "Your Anthropic API account is out of credits. Add credits at console.anthropic.com → Plans & Billing, then re-upload. (API credits are separate from a Claude.ai subscription.)";
    } else if (status === 401 || status === 403) {
      msg = "Your ANTHROPIC_API_KEY was rejected (invalid, revoked, or lacking access). Check the key in .env.local and restart the dev server.";
    } else if (status === 429) {
      msg = "Rate limited or out of credits on your Anthropic account. Wait a moment or check your billing, then retry.";
    } else if (/pdf|document|password|encrypt|image|decode/i.test(detail)) {
      msg = `"${file.name}" could not be read. It may be password-protected, a scanned image, or corrupted. Marker needs a text-based PDF.`;
    } else {
      // Surface the real reason (dev tool) so failures are diagnosable, not opaque.
      msg = `Could not extract "${file.name}" (HTTP ${status}): ${detail.slice(0, 300)}`;
    }
    return NextResponse.json({ error: msg }, { status: status >= 400 && status < 500 ? 422 : 502 });
  }
}
