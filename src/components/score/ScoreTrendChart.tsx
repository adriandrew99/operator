'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import type { CheckInRatings } from '@/lib/types/database';

interface ScoreTrendChartProps {
  history: {
    date: string;
    score: number;
    check_in: CheckInRatings | null;
    version: number;
  }[];
}

export function ScoreTrendChart({ history }: ScoreTrendChartProps) {
  const { points, maxScore, labels, width, height, padding } = useMemo(() => {
    const h = 160;
    const w = 600;
    const pad = { top: 20, right: 16, bottom: 28, left: 32 };
    const max = Math.max(100, ...history.map(h => h.score));

    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const pts = history.map((entry, i) => ({
      x: pad.left + (chartW / Math.max(1, history.length - 1)) * i,
      y: pad.top + chartH - (entry.score / max) * chartH,
      ...entry,
    }));

    // Y-axis labels
    const lbls = [0, 25, 50, 75, 100].map(v => ({
      value: v,
      y: pad.top + chartH - (v / max) * chartH,
    }));

    return { points: pts, maxScore: max, labels: lbls, width: w, height: h, padding: pad };
  }, [history]);

  if (history.length === 0) return null;

  // Build SVG path
  const linePath = points.map((p, i) =>
    i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
  ).join(' ');

  // Area fill path
  const areaPath = linePath +
    ` L ${points[points.length - 1].x} ${height - padding.bottom}` +
    ` L ${points[0].x} ${height - padding.bottom} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[400px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis gridlines and labels */}
        {labels.map(l => (
          <g key={l.value}>
            <line
              x1={padding.left}
              y1={l.y}
              x2={width - padding.right}
              y2={l.y}
              stroke="var(--border-color)"
              strokeOpacity={0.2}
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 6}
              y={l.y + 3}
              textAnchor="end"
              className="text-xs fill-[var(--text-tertiary)]"
            >
              {l.value}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill="var(--accent)"
          opacity={0.06}
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={p.check_in ? 4 : 3}
              fill={p.check_in ? 'var(--accent)' : 'var(--surface-secondary)'}
              stroke="var(--accent)"
              strokeWidth={p.check_in ? 0 : 1.5}
            />
            {/* X-axis date labels (show every 5th) */}
            {(i === 0 || i === points.length - 1 || i % 5 === 0) && (
              <text
                x={p.x}
                y={height - 6}
                textAnchor="middle"
                className="text-xs fill-[var(--text-tertiary)]"
              >
                {formatDate(p.date)}
              </text>
            )}
          </g>
        ))}

        {/* 55-threshold line (max without check-in) */}
        {(() => {
          const chartH = height - padding.top - padding.bottom;
          const thresholdY = padding.top + chartH - (55 / maxScore) * chartH;
          return (
            <g>
              <line
                x1={padding.left}
                y1={thresholdY}
                x2={width - padding.right}
                y2={thresholdY}
                stroke="var(--accent)"
                strokeOpacity={0.25}
                strokeDasharray="6 3"
              />
              <text
                x={width - padding.right + 2}
                y={thresholdY + 3}
                className="text-[7px] fill-[var(--accent)]"
                opacity={0.5}
              >
                55
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-text-primary" />
          <span className="text-xs text-text-tertiary">With check-in</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-text-secondary bg-surface-secondary" />
          <span className="text-xs text-text-tertiary">Auto-only</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 border-t border-dashed border-text-tertiary/30" />
          <span className="text-xs text-text-tertiary">Max without check-in (55)</span>
        </div>
      </div>
    </div>
  );
}
