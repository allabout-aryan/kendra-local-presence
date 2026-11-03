'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-white">
      <tr className="border-b border-ink-200">{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  className,
  align = 'left',
  sortable,
  active,
  direction,
  onSort,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  active?: boolean;
  direction?: 'asc' | 'desc';
  onSort?: () => void;
}) {
  return (
    <th
      scope="col"
      className={cn(
        'label-caps whitespace-nowrap px-3 py-2 font-medium',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      {sortable ? (
        <button
          onClick={onSort}
          className={cn('inline-flex items-center gap-1 transition-colors hover:text-ink-700', active && 'text-ink-800')}
        >
          {children}
          <span aria-hidden className={cn('text-[9px]', active ? 'opacity-100' : 'opacity-0')}>
            {direction === 'asc' ? '▲' : '▼'}
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({
  children,
  className,
  align = 'left',
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn('px-3 py-2.5 align-middle text-ink-700', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn('border-b border-ink-100 last:border-0', onClick && 'row-hover cursor-pointer', className)}
    >
      {children}
    </tr>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-200 px-3 py-2">
      <p className="tabular text-[11px] text-ink-500">
        {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="rounded-md border border-ink-200 px-2 py-1 text-[11px] font-medium text-ink-600 disabled:opacity-40 enabled:hover:bg-ink-50"
        >
          Previous
        </button>
        <span className="tabular px-1 text-[11px] text-ink-500">
          {page + 1} / {pages}
        </span>
        <button
          onClick={() => onPage(Math.min(pages - 1, page + 1))}
          disabled={page >= pages - 1}
          className="rounded-md border border-ink-200 px-2 py-1 text-[11px] font-medium text-ink-600 disabled:opacity-40 enabled:hover:bg-ink-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
