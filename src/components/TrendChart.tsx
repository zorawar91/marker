"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BIOMARKERS } from "@/lib/biomarkers";
import { formatMonthYear, formatValue } from "@/lib/display";
import type { Series } from "@/lib/types";

/**
 * One chart per biomarker: value over time with the reference range shaded and
 * out-of-range points visually distinct (R3). One-sided ranges shade against the
 * axis domain so the hero cholesterol/LDL charts still show a reference band.
 */
export function TrendChart({ series, height = 176 }: { series: Series; height?: number }) {
  const marker = BIOMARKERS[series.canonicalId];
  const data = series.points.map((p, i) => ({
    i,
    label: formatMonthYear(p.date),
    value: p.value,
    refLow: p.refLow,
    refHigh: p.refHigh,
    status: p.status,
  }));

  const values = data.flatMap((d) => [d.value, d.refLow, d.refHigh].filter((v): v is number => v !== null));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || max || 1) * 0.15;
  const domain: [number, number] = [Math.max(0, min - pad), max + pad];

  const band = series.points[series.points.length - 1];
  const hasBand = band.refLow !== null || band.refHigh !== null;
  const bandY1 = band.refLow ?? domain[0];
  const bandY2 = band.refHigh ?? domain[1];
  const gid = `grad-${series.canonicalId}`;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {hasBand && (
            <ReferenceArea
              y1={bandY1}
              y2={bandY2}
              fill="var(--ok)"
              fillOpacity={0.07}
              stroke="var(--ok)"
              strokeOpacity={0.2}
              strokeDasharray="4 4"
            />
          )}

          <XAxis
            dataKey="label"
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            padding={{ left: 6, right: 6 }}
          />
          <YAxis
            domain={domain}
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v) => formatValue(v)}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-2)", strokeWidth: 1 }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "var(--shadow-md)",
              fontSize: 12,
              color: "var(--ink)",
              padding: "8px 10px",
            }}
            labelStyle={{ color: "var(--ink-2)", fontWeight: 600, marginBottom: 2 }}
            formatter={(value, _n, item) => {
              const p = item.payload as (typeof data)[number];
              const val = Number(value);
              const range =
                p.refLow !== null && p.refHigh !== null
                  ? `range ${formatValue(p.refLow)}–${formatValue(p.refHigh)}`
                  : p.refHigh !== null
                    ? `range < ${formatValue(p.refHigh)}`
                    : p.refLow !== null
                      ? `range > ${formatValue(p.refLow)}`
                      : "no range";
              return [`${formatValue(val)} ${marker.canonicalUnit} · ${range}`, "Value"];
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill={`url(#${gid})`}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: (typeof data)[number] };
              const outOfRange = payload.status === "high" || payload.status === "low";
              return (
                <circle
                  key={`${payload.i}`}
                  cx={cx}
                  cy={cy}
                  r={outOfRange ? 4.5 : 3.5}
                  fill={outOfRange ? "var(--concern)" : "var(--primary)"}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 5.5, strokeWidth: 2, stroke: "var(--surface)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-report fallback (R3): value-vs-range bar when only one data point exists. */
export function SingleValueBar({ series }: { series: Series }) {
  const marker = BIOMARKERS[series.canonicalId];
  const p = series.points[0];
  const low = p.refLow ?? 0;
  const high = p.refHigh ?? p.value * 1.5;
  const axisMin = Math.min(low, p.value) * 0.85;
  const axisMax = Math.max(high, p.value) * 1.15;
  const span = axisMax - axisMin || 1;
  const pct = (v: number) => `${((v - axisMin) / span) * 100}%`;
  const outOfRange = p.status === "high" || p.status === "low";

  return (
    <div className="py-5">
      <div className="relative h-8 rounded-md bg-[var(--surface-2)]">
        {p.refLow !== null || p.refHigh !== null ? (
          <div
            className="absolute top-0 bottom-0 rounded-md"
            style={{
              left: pct(p.refLow ?? axisMin),
              right: `calc(100% - ${pct(p.refHigh ?? axisMax)})`,
              background: "var(--ok-bg)",
              border: "1px dashed var(--ok)",
            }}
          />
        ) : null}
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
          style={{ left: pct(p.value), background: outOfRange ? "var(--concern)" : "var(--primary)" }}
          title={`${formatValue(p.value)} ${marker.canonicalUnit}`}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-[var(--ink-3)]">
        <span className="tnum">{formatValue(axisMin)}</span>
        <span className="tnum font-semibold text-[var(--ink)]">
          {formatValue(p.value)} {marker.canonicalUnit}
        </span>
        <span className="tnum">{formatValue(axisMax)}</span>
      </div>
    </div>
  );
}
