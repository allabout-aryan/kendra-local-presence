'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
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

/* ------------------------------------------------------------ heatmap */

const HEAT_COLOURS = ['#EFEFF2', '#DCEFE8', '#A8D5C6', '#4E9C82', '#0E5B46'];
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function DiscoveryHeatmap({
  weeks,
  levels,
  metricLabel = 'views',
}: {
  weeks: (import('@/lib/domain/heatmap').HeatCell | null)[][];
  levels: number[];
  metricLabel?: string;
}) {
  const months = React.useMemo(() => {
    const seen: { index: number; label: string }[] = [];
    weeks.forEach((week, index) => {
      const first = week.find((cell) => cell !== null);
      if (!first) return;
      const month = new Date(`${first.date}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short' });
      if (!seen.some((entry) => entry.label === month)) seen.push({ index, label: month });
    });
    return seen;
  }, [weeks]);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-[3px]">
        <div className="mr-1 flex flex-col gap-[3px] pt-[15px]">
          {DAY_LABELS.map((label, index) => (
            <span key={`${label}-${index}`} className="h-[11px] w-2 text-[9px] leading-[11px] text-ink-400">
              {index % 2 === 0 ? label : ''}
            </span>
          ))}
        </div>
        <div>
          <div className="mb-1 flex gap-[3px]">
            {weeks.map((_, index) => {
              const month = months.find((entry) => entry.index === index);
              return (
                <span key={index} className="w-[11px] text-[9px] leading-none text-ink-400">
                  {month ? month.label : ''}
                </span>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {week.map((cell, dayIndex) =>
                  cell ? (
                    <div
                      key={cell.date}
                      className="h-[11px] w-[11px] rounded-[2px] transition-transform hover:scale-125"
                      style={{ backgroundColor: HEAT_COLOURS[cell.level] }}
                      title={`${cell.date}: ${cell.value.toLocaleString('en-IN')} ${metricLabel}`}
                    />
                  ) : (
                    <div key={`empty-${weekIndex}-${dayIndex}`} className="h-[11px] w-[11px]" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-400">
        <span>Less</span>
        {HEAT_COLOURS.map((colour) => (
          <span key={colour} className="h-[9px] w-[9px] rounded-[2px]" style={{ backgroundColor: colour }} />
        ))}
        <span>More</span>
        <span className="ml-2">quartile thresholds {levels.map((level) => Math.round(level)).join(' / ')}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------- comparison chart */

export function ComparisonChart({
  current,
  previous,
  dates,
  colour = '#0E5B46',
  label = 'This period',
  previousLabel = 'Previous period',
  valueFormatter = (value: number) => String(value),
  height = 160,
}: {
  current: number[];
  previous: number[];
  dates: string[];
  colour?: string;
  label?: string;
  previousLabel?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}) {
  const width = 720;
  const padding = { top: 10, right: 8, bottom: 20, left: 38 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...current, ...previous);
  const [hover, setHover] = React.useState<number | null>(null);

  const x = (index: number, length: number) => padding.left + (length <= 1 ? innerW / 2 : (index / (length - 1)) * innerW);
  const y = (value: number) => padding.top + innerH - (value / max) * innerH;

  const line = (values: number[]) =>
    values
      .map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index, values.length).toFixed(1)},${y(value).toFixed(1)}`)
      .join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} role="img" aria-label={`${label} versus ${previousLabel}`} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((fraction) => {
          const value = Math.round(max * fraction);
          return (
            <g key={fraction}>
              <line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} stroke="#EFEFF2" />
              <text x={padding.left - 6} y={y(value) + 3} textAnchor="end" className="fill-ink-400 text-[9px]">
                {valueFormatter(value)}
              </text>
            </g>
          );
        })}

        <path d={line(previous)} fill="none" stroke="#C7C7CF" strokeWidth={1.5} strokeDasharray="4 3" strokeLinecap="round" />
        <path d={line(current)} fill="none" stroke={colour} strokeWidth={1.9} strokeLinejoin="round" strokeLinecap="round" />

        {current.map((_, index) => (
          <rect
            key={index}
            x={x(index, current.length) - innerW / (current.length * 2)}
            y={padding.top}
            width={Math.max(2, innerW / current.length)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}

        {hover !== null && (
          <g>
            <line x1={x(hover, current.length)} x2={x(hover, current.length)} y1={padding.top} y2={padding.top + innerH} stroke="#C7C7CF" strokeDasharray="3 3" />
            <circle cx={x(hover, current.length)} cy={y(current[hover] ?? 0)} r={2.6} fill={colour} />
            <circle cx={x(hover, current.length)} cy={y(previous[hover] ?? 0)} r={2.2} fill="#C7C7CF" />
          </g>
        )}

        {dates.map((date, index) =>
          index % Math.ceil(dates.length / 5) === 0 ? (
            <text key={date} x={x(index, dates.length)} y={height - 5} textAnchor="middle" className="fill-ink-400 text-[9px]">
              {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-4 rounded" style={{ backgroundColor: colour }} />
          {label}
          {hover !== null && <span className="tabular font-medium text-ink-900">{valueFormatter(current[hover] ?? 0)}</span>}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-4 rounded border-t border-dashed border-ink-300" />
          {previousLabel}
          {hover !== null && <span className="tabular font-medium text-ink-600">{valueFormatter(previous[hover] ?? 0)}</span>}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- rating bars */

export function RatingBars({ counts }: { counts: Record<number, number> }) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((rating) => {
        const value = counts[rating] ?? 0;
        const width = (value / total) * 100;
        return (
          <div key={rating} className="flex items-center gap-2">
            <span className="tabular w-3 text-[11px] text-ink-500">{rating}</span>
            <Star className="h-2.5 w-2.5 fill-amber-600 text-amber-600" aria-hidden />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div
                className={cn('h-full rounded-full', rating >= 4 ? 'bg-pine-600' : rating === 3 ? 'bg-amber-600' : 'bg-brick-600')}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="tabular w-6 text-right text-[11px] text-ink-600">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------- score trend */

export function ScoreTrend({ points, height = 120 }: { points: { captured_on: string; avg_score: number }[]; height?: number }) {
  if (points.length < 2) {
    return <p className="px-1 py-6 text-center text-[11px] text-ink-400">Score history builds up as the portfolio is audited.</p>;
  }
  const width = 640;
  const padding = { top: 8, right: 6, bottom: 16, left: 26 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const values = points.map((point) => point.avg_score);
  const min = Math.min(...values, 60);
  const max = Math.max(...values, 90);
  const span = max - min || 1;

  const x = (index: number) => padding.left + (index / (points.length - 1)) * innerW;
  const y = (value: number) => padding.top + innerH - ((value - min) / span) * innerH;
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.avg_score).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} role="img" aria-label="Portfolio audit score trend">
      <defs>
        <linearGradient id="scoreFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0E5B46" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0E5B46" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${x(points.length - 1)},${padding.top + innerH} L${padding.left},${padding.top + innerH} Z`} fill="url(#scoreFade)" />
      <path d={line} fill="none" stroke="#0E5B46" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].avg_score)} r={3} fill="#0E5B46" />
      <text x={padding.left} y={height - 3} className="fill-ink-400 text-[9px]">
        {new Date(`${points[0].captured_on}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
      </text>
      <text x={width - padding.right} y={height - 3} textAnchor="end" className="fill-ink-400 text-[9px]">
        today
      </text>
      <text x={padding.left - 4} y={y(max) + 3} textAnchor="end" className="fill-ink-400 text-[9px]">
        {Math.round(max)}
      </text>
      <text x={padding.left - 4} y={y(min) + 3} textAnchor="end" className="fill-ink-400 text-[9px]">
        {Math.round(min)}
      </text>
    </svg>
  );
}
