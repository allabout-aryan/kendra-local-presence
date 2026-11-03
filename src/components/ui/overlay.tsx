'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { Button } from './primitives';

/* ------------------------------------------------------------- focus trap */

function useLockBody(open: boolean) {
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
}

function useEscape(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
}

/* ------------------------------------------------------------------ Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}) {
  useLockBody(open);
  useEscape(open, onClose);
  const panel = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="fixed inset-0 bg-ink-950/30 backdrop-blur-[1px] animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn('relative z-10 w-full animate-slide-up rounded-xl border border-ink-200 bg-white shadow-pop', widths[width])}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-950">{title}</h2>
            {description && <p className="mt-1 text-xs leading-relaxed text-ink-500">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-5 pb-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-ink-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Drawer */

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useLockBody(open);
  useEscape(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-950/25 animate-fade-in" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex h-full w-full max-w-[520px] animate-slide-up flex-col border-l border-ink-200 bg-white shadow-pop sm:animate-fade-in"
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-ink-950">{title}</h2>
            {description && <p className="mt-0.5 truncate text-xs text-ink-500">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-ink-200 px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}

/* ----------------------------------------------------------- ConfirmDialog */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-lg bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        This action is recorded in the workspace activity log.
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Toast */

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

const ToastContext = React.createContext<{ push: (toast: Omit<Toast, 'id'>) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 5200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex animate-slide-up items-start gap-2.5 rounded-lg border border-ink-200 bg-white p-3 shadow-pop"
          >
            <span className="mt-0.5">
              {toast.tone === 'success' && <CheckCircle2 className="h-4 w-4 text-pine-600" aria-hidden />}
              {toast.tone === 'error' && <TriangleAlert className="h-4 w-4 text-brick-600" aria-hidden />}
              {toast.tone === 'info' && <Info className="h-4 w-4 text-sky-600" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink-950">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{toast.description}</p>}
            </div>
            <button
              onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
              className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context;
}

/* ------------------------------------------------------------------- Menu */

export function Menu({ trigger, children, align = 'right' }: { trigger: React.ReactNode; children: React.ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((value) => !value)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-40 mt-1 min-w-[180px] animate-slide-up overflow-hidden rounded-lg border border-ink-200 bg-white p-1 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  tone = 'default',
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'danger';
  icon?: React.ReactNode;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors',
        tone === 'danger' ? 'text-brick-700 hover:bg-brick-50' : 'text-ink-700 hover:bg-ink-100',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
