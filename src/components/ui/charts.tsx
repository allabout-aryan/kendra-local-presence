'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { areaPath, sparklinePath } from '@/lib/domain/kpis';

export function Sparkline({
  values,
  width = 88,
  height = 24,
  className,
  tone = 'accent',
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  tone?: 'accent' | 'muted' | 'danger';
}) {
  const stroke = tone === 'danger' ? '#B42318' : tone === 'muted' ? '#8C8C97' : '#0E5B46';
  const fill = tone === 'danger' ? 'rgba(180,35,24,0.08)' : tone === 'muted' ? 'rgba(140,140,151,0.10)' : 'rgba(14,91,70,0.08)';
  if (values.length === 0) return <div className={cn('h-6 w-[88px]', className)} aria-hidden />;
  return (
    <svg width={width} height={height} className={className} aria-hidden role="presentation">
      <path d={areaPath(values, width, height, 2)} fill={fill} />
      <path d={sparklinePath(values, width, height, 2)} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export interface TrendSeries {
  label: string;
  colour: string;
  values: number[];
}

/** Hand-rolled SVG so the chart ships with no charting dependency. */
export function TrendChart({
  series,
  dates,
  height = 180,
  valueFormatter = (n: number) => String(n),
}: {
  series: TrendSeries[];
  dates: string[];
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  const width = 720;
  const padding = { top: 12, right: 8, bottom: 22, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, ...all);
  const [hover, setHover] = React.useState<number | null>(null);

  const x = (index: number) => padding.left + (dates.length <= 1 ? innerW / 2 : (index / (dates.length - 1)) * innerW);
  const y = (value: number) => padding.top + innerH - (value / max) * innerH;

  const ticks = [0, 0.5, 1].map((fraction) => Math.round(max * fraction));

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[180px] w-full"
        role="img"
        aria-label={`Trend over ${dates.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke="#EFEFF2" strokeWidth={1} />
            <text x={padding.left - 8} y={y(tick) + 3} textAnchor="end" className="fill-ink-400 text-[9px]">
              {valueFormatter(tick)}
            </text>
          </g>
        ))}

        {series.map((s) => (
          <path
            key={s.label}
            d={sparklinePath(s.values, innerW, innerH, 0)}
            transform={`translate(${padding.left},${padding.top})`}
            fill="none"
            stroke={s.colour}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {dates.map((_, index) => (
          <rect
            key={index}
            x={x(index) - innerW / (dates.length * 2)}
            y={padding.top}
            width={Math.max(2, innerW / dates.length)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padding.top} y2={padding.top + innerH} stroke="#C7C7CF" strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={s.label} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={2.5} fill={s.colour} />
            ))}
          </g>
        )}

        {dates.map((date, index) =>
          index % Math.ceil(dates.length / 5) === 0 ? (
            <text key={date} x={x(index)} y={height - 6} textAnchor="middle" className="fill-ink-400 text-[9px]">
              {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-ink-500">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.colour }} />
            {s.label}
            {hover !== null && (
              <span className="tabular font-medium text-ink-800">{valueFormatter(s.values[hover] ?? 0)}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const radius = (size - 5) / 2;
  const circumference = 2 * Math.PI * radius;
  const colour = score >= 85 ? '#0E5B46' : score >= 65 ? '#9A5B00' : '#B42318';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Audit score ${score} out of 100`} role="img">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EFEFF2" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colour}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="tabular fill-ink-900 text-[10px] font-semibold">
        {score}
      </text>
    </svg>
  );
}

export function DistributionBars({
  segments,
  total,
}: {
  segments: { label: string; value: number; colour: string }[];
  total: number;
}) {
  const safeTotal = total || 1;
  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-ink-100">
        {segments.map((segment) => (
          <div
            key={segment.label}
            style={{ width: `${(segment.value / safeTotal) * 100}%`, backgroundColor: segment.colour }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((segment) => (
          <span key={segment.label} className="flex items-center gap-1.5 text-[11px] text-ink-500">
            <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: segment.colour }} />
            {segment.label}
            <span className="tabular font-medium text-ink-800">{segment.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function RankGrid({ cells }: { cells: { row: number; col: number; position: number }[] }) {
  const colour = (position: number) => {
    if (position === 0) return 'bg-ink-100 text-ink-400';
    if (position <= 3) return 'bg-pine-600 text-white';
    if (position <= 10) return 'bg-pine-100 text-pine-700';
    if (position <= 20) return 'bg-amber-100 text-amber-700';
    return 'bg-brick-100 text-brick-700';
  };
  const size = Math.max(...cells.map((c) => Math.max(c.row, c.col))) + 1;
  return (
    <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, 26px)` }} aria-label="Local rank grid">
      {Array.from({ length: size * size }).map((_, index) => {
        const row = Math.floor(index / size);
        const col = index % size;
        const cell = cells.find((c) => c.row === row && c.col === col);
        const position = cell?.position ?? 0;
        return (
          <div
            key={index}
            className={cn('tabular flex h-[26px] w-[26px] items-center justify-center rounded text-[10px] font-semibold', colour(position))}
            title={position === 0 ? 'Not in top 20' : `Rank ${position}`}
          >
            {position === 0 ? '·' : position}
          </div>
        );
      })}
    </div>
  );
}
