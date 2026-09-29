"use client";

import { useMemo, useRef, useState } from "react";

export type Series = { key: string; label: string; color: string; values: (number | null)[] };

/**
 * Multi-series line chart over evenly spaced x labels (days).
 * Hover anywhere to get a crosshair and a tooltip with every series' value.
 * Gaps (null) break the line instead of drawing to zero.
 */
export default function LineChart({
  xLabels,
  series,
  yMin,
  yMax,
  yTicks,
  format = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)),
  height = 220,
}: {
  xLabels: string[];
  series: Series[];
  yMin: number;
  yMax: number;
  yTicks: number[];
  format?: (v: number) => string;
  height?: number;
}) {
  const W = 640;
  const pad = { l: 32, r: 12, t: 10, b: 26 };
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const x = (i: number) => pad.l + (xLabels.length <= 1 ? innerW / 2 : (i / (xLabels.length - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = "";
        let pen = false;
        s.values.forEach((v, i) => {
          if (v === null) {
            pen = false;
            return;
          }
          d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
          pen = true;
        });
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, xLabels.length, yMin, yMax],
  );

  // Show at most ~7 x labels so they never collide.
  const step = Math.max(1, Math.ceil(xLabels.length / 7));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / innerW) * (xLabels.length - 1));
    setHover(Math.max(0, Math.min(xLabels.length - 1, i)));
  };

  const tooltipLeft = hover === null ? 0 : (x(hover) / W) * 100;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${height}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={series.map((s) => s.label).join(", ")}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--chart-axis)">
              {format(t)}
            </text>
          </g>
        ))}
        {xLabels.map((l, i) =>
          (i % step === 0 && xLabels.length - 1 - i >= step) || i === xLabels.length - 1 ? (
            <text
              key={i}
              x={x(i)}
              y={height - 6}
              textAnchor={xLabels.length > 1 && i === xLabels.length - 1 ? "end" : i === 0 && xLabels.length > 1 ? "start" : "middle"}
              fontSize={11}
              fill="var(--chart-axis)"
            >
              {l}
            </text>
          ) : null,
        )}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} stroke="var(--chart-axis)" strokeWidth={1} />
        )}
        {series.map((s, si) => (
          <path key={s.key} d={paths[si]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map((s) =>
          s.values.map((v, i) =>
            v === null ? null : (
              <circle
                key={`${s.key}-${i}`}
                cx={x(i)}
                cy={y(v)}
                r={hover === i ? 5 : xLabels.length <= 10 ? 4 : 0}
                fill={s.color}
                stroke="var(--chart-surface)"
                strokeWidth={2}
              />
            ),
          ),
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${tooltipLeft}%`,
            transform: `translateX(${tooltipLeft > 60 ? "calc(-100% - 10px)" : "10px"})`,
          }}
        >
          <p className="mb-1 font-semibold text-stone-800">{xLabels[hover]}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-3 text-stone-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-medium text-stone-900">{s.values[hover] === null ? "–" : format(s.values[hover]!)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ series }: { series: Pick<Series, "key" | "label" | "color">[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}
