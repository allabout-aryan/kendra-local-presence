'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-pine-600 text-white hover:bg-pine-700 active:bg-pine-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
  secondary: 'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100',
  ghost: 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-brick-600 text-white hover:bg-brick-700',
  subtle: 'bg-ink-100 text-ink-800 hover:bg-ink-200',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-lg',
  lg: 'h-10 px-4 text-sm gap-2 rounded-lg',
  icon: 'h-8 w-8 rounded-lg justify-center',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading, icon, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center font-medium transition-[background-color,border-color,color,box-shadow] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------- Badge */

type BadgeTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info' | 'accent';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  positive: 'bg-pine-50 text-pine-700 ring-pine-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
  danger: 'bg-brick-50 text-brick-700 ring-brick-100',
  info: 'bg-sky-50 text-sky-600 ring-sky-100',
  accent: 'bg-pine-600 text-white ring-pine-600',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  dot,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-ink-200 px-4 py-3', className)}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold text-ink-950">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Fields */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-xs font-medium text-ink-700">
        {label}
        {required && <span className="text-brick-600">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-brick-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

const INPUT_BASE =
  'w-full rounded-lg border bg-white px-2.5 text-[13px] text-ink-900 placeholder:text-ink-400 transition-colors ' +
  'focus:border-pine-600 focus:outline-none focus:ring-2 focus:ring-pine-600/15 disabled:bg-ink-50 disabled:text-ink-500';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(INPUT_BASE, 'h-9', invalid ? 'border-brick-600' : 'border-ink-200', className)}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(INPUT_BASE, 'min-h-[80px] py-2 leading-relaxed', invalid ? 'border-brick-600' : 'border-ink-200', className)}
      {...props}
    />
  );
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(INPUT_BASE, 'h-9 cursor-pointer border-ink-200 pr-8', className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  className,
  indeterminate,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: string;
  className?: string;
  indeterminate?: boolean;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return (
    <label className={cn('flex cursor-pointer select-none items-start gap-2.5', className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-ink-300 text-pine-600 focus:ring-pine-600/30"
      />
      <span className="min-w-0">
        <span className="block text-[13px] text-ink-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
      </span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-pine-600' : 'bg-ink-300',
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------- misc */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-ink-400', className)} aria-hidden />;
}

export function Avatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600 ring-1 ring-inset ring-ink-200',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {letters || '··'}
    </span>
  );
}

export function Progress({
  value,
  tone = 'accent',
  className,
}: {
  value: number;
  tone?: 'accent' | 'warning' | 'danger';
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const colour = tone === 'danger' ? 'bg-brick-600' : tone === 'warning' ? 'bg-amber-600' : 'bg-pine-600';
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-100', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', colour)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink-50 text-ink-400 ring-1 ring-inset ring-ink-200">
          {icon}
        </div>
      )}
      <p className="text-[13px] font-medium text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-0.5 border-b border-ink-200', className)} role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative -mb-px flex items-center gap-1.5 px-2.5 pb-2 pt-1 text-[13px] font-medium transition-colors',
              active ? 'border-b-2 border-ink-950 text-ink-950' : 'border-b-2 border-transparent text-ink-500 hover:text-ink-800',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'tabular rounded px-1 text-[10px] font-semibold',
                  active ? 'bg-ink-950 text-white' : 'bg-ink-100 text-ink-500',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-500">
      {children}
    </kbd>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-ink-200', className)} />;
}
