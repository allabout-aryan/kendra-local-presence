'use client';

import * as React from 'react';

export interface SavedView<T> {
  id: string;
  name: string;
  payload: T;
}

const PREFIX = 'kendra.views.v1';

function read<T>(scope: string): SavedView<T>[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${PREFIX}.${scope}`);
    return raw ? (JSON.parse(raw) as SavedView<T>[]) : [];
  } catch {
    return [];
  }
}

function write<T>(scope: string, views: SavedView<T>[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${PREFIX}.${scope}`, JSON.stringify(views));
  } catch {
    // storage full or blocked — saved views are a convenience, not a requirement
  }
}

/** Named filter combinations, kept per browser so they survive a reload. */
export function useSavedViews<T>(scope: string) {
  const [views, setViews] = React.useState<SavedView<T>[]>([]);

  React.useEffect(() => {
    setViews(read<T>(scope));
  }, [scope]);

  const save = React.useCallback(
    (name: string, payload: T) => {
      setViews((current) => {
        const next = [
          ...current.filter((view) => view.name.toLowerCase() !== name.toLowerCase()),
          { id: `${Date.now()}`, name, payload },
        ];
        write(scope, next);
        return next;
      });
    },
    [scope],
  );

  const remove = React.useCallback(
    (id: string) => {
      setViews((current) => {
        const next = current.filter((view) => view.id !== id);
        write(scope, next);
        return next;
      });
    },
    [scope],
  );

  return { views, save, remove };
}
