'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, Building2, ChevronsUpDown, ClipboardList, FileBarChart, LayoutDashboard,
  LogOut, Menu, MessageSquareText, Newspaper, Plus, RefreshCw, Search, Settings, ShieldCheck, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuditResults, useStore } from '@/lib/data/store';
import { Avatar, Badge, Button, Kbd, Spinner } from '@/components/ui/primitives';
import { Menu as DropMenu, MenuItem, useToast } from '@/components/ui/overlay';
import { roleLabel } from '@/lib/domain/permissions';

const NAV = [
  {
    section: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/locations', label: 'Outlets', icon: Building2 },
      { href: '/reviews', label: 'Reviews', icon: MessageSquareText },
      { href: '/posts', label: 'Posts', icon: Newspaper },
      { href: '/bulk', label: 'Bulk edit', icon: ClipboardList },
    ],
  },
  {
    section: 'Insights',
    items: [
      { href: '/reports', label: 'Reports', icon: FileBarChart },
      { href: '/audit', label: 'Audit', icon: ShieldCheck },
    ],
  },
  {
    section: 'Admin',
    items: [
      { href: '/team', label: 'Team', icon: Users },
      { href: '/activity', label: 'Activity', icon: Activity },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-4" aria-label="Kendra home">
      <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-pine-600 text-[13px] font-bold text-white">K</span>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">Kendra</span>
    </Link>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const items = NAV.flatMap((group) => group.items.map((item) => ({ ...item, section: group.section })));
  const filtered = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-ink-950/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg animate-slide-up overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
        <div className="flex items-center gap-2 border-b border-ink-200 px-3">
          <Search className="h-4 w-4 text-ink-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && filtered[0]) {
                router.push(filtered[0].href);
                onClose();
              }
            }}
            placeholder="Jump to…"
            aria-label="Search navigation"
            className="h-11 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-400"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="max-h-[320px] overflow-y-auto p-1.5">
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-500">Nothing matches “{query}”.</li>}
          {filtered.map((item) => (
            <li key={item.href}>
              <button
                onClick={() => {
                  router.push(item.href);
                  onClose();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-700 hover:bg-ink-100"
              >
                <item.icon className="h-4 w-4 text-ink-400" aria-hidden />
                {item.label}
                <span className="ml-auto text-[11px] text-ink-400">{item.section}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function AppShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { org, orgs, role, user, mode, signOut, switchOrg, syncNow, syncAuditSnapshots } = useStore();
  const audits = useAuditResults();
  const syncedFor = React.useRef<string | null>(null);

  // Persist today's audit score per outlet once per workspace visit so the
  // portfolio has a real score history rather than a single number.
  React.useEffect(() => {
    if (mode !== 'supabase' || !org || audits.length === 0) return;
    const key = `${org.id}:${new Date().toISOString().slice(0, 10)}`;
    if (syncedFor.current === key) return;
    syncedFor.current = key;
    void syncAuditSnapshots(
      audits.map(({ location, result }) => ({
        location_id: location.id,
        score: result.score,
        findings: result.findings.length,
      })),
    ).catch(() => {
      // a failed snapshot must never break the workspace
    });
  }, [mode, org, audits, syncAuditSnapshots]);
  const { push } = useToast();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-950">
      <Logo />
      <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Main">
        {NAV.map((group) => (
          <div key={group.section} className="mb-4">
            <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">{group.section}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors',
                        active ? 'bg-ink-800 text-white' : 'text-ink-300 hover:bg-ink-900 hover:text-white',
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon className={cn('h-4 w-4', active ? 'text-white' : 'text-ink-500 group-hover:text-ink-300')} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-ink-800 p-2">
        <DropMenu
          align="left"
          trigger={
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-ink-900">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-pine-600 text-[11px] font-bold text-white">
                {org?.name?.[0] ?? 'K'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-white">{org?.name ?? 'No workspace'}</span>
                <span className="block truncate text-[10px] text-ink-500">{role ? roleLabel(role) : '—'}</span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden />
            </button>
          }
        >
          <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-ink-400">Workspaces</p>
          {orgs.map((entry) => (
            <MenuItem
              key={entry.org.id}
              onClick={() => {
                void switchOrg(entry.org.id);
                router.push('/dashboard');
              }}
              icon={<Building2 className="h-3.5 w-3.5" />}
            >
              <span className={cn('truncate', entry.org.id === org?.id && 'font-semibold text-ink-950')}>{entry.org.name}</span>
            </MenuItem>
          ))}
          <div className="my-1 h-px bg-ink-200" />
          <MenuItem onClick={() => router.push('/onboarding')} icon={<Plus className="h-3.5 w-3.5" />}>
            New workspace
          </MenuItem>
        </DropMenu>

        <div className="mt-1 flex items-center gap-2 rounded-md px-2 py-2">
          <Avatar name={user?.name ?? 'User'} size={24} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-white">{user?.name ?? 'Signed in'}</p>
            <p className="truncate text-[10px] text-ink-500">{user?.email ?? ''}</p>
          </div>
          <button
            onClick={() => {
              void signOut().then(() => router.push('/login'));
            }}
            className="rounded p-1 text-ink-500 hover:bg-ink-900 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-[232px] lg:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="relative z-10 h-full w-[260px] animate-fade-in">
            {sidebar}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded p-1.5 text-ink-400 hover:bg-ink-900 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="lg:pl-[232px]">
        {mode === 'demo' && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-amber-50 px-4 py-1.5 text-center text-[11px] text-amber-700">
            <Badge tone="warning">Demo workspace</Badge>
            <span>Sample data for a fictional brand — edits are saved in this browser only. Connect Supabase to use real data.</span>
          </div>
        )}

        <header className="sticky top-0 z-20 border-b border-ink-200 bg-paper/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="-ml-1 rounded-md p-1.5 text-ink-600 hover:bg-ink-100 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[15px] font-semibold text-ink-950">{title}</h1>
              {subtitle && <p className="truncate text-[11px] text-ink-500">{subtitle}</p>}
            </div>

            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-[12px] text-ink-400 hover:border-ink-300 hover:text-ink-600 sm:flex"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              Jump to
              <Kbd>⌘K</Kbd>
            </button>

            <Button
              size="sm"
              variant="secondary"
              loading={syncing}
              onClick={async () => {
                setSyncing(true);
                try {
                  await syncNow();
                  push({ tone: 'success', title: 'Sync complete', description: 'Outlets refreshed from Google Business Profile.' });
                } catch (error) {
                  push({ tone: 'error', title: 'Sync failed', description: error instanceof Error ? error.message : 'Try again.' });
                } finally {
                  setSyncing(false);
                }
              }}
              icon={syncing ? undefined : <RefreshCw className="h-3.5 w-3.5" />}
            >
              <span className="hidden sm:inline">Sync</span>
            </Button>

            {actions}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export function PageGuard({ children }: { children: React.ReactNode }) {
  const { status, user, org, error } = useStore();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'ready' && !user) router.replace('/login');
    if (status === 'ready' && user && !org) router.replace('/onboarding');
  }, [status, user, org, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex items-center gap-2 text-[13px] text-ink-500">
          <Spinner /> Loading workspace…
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div className="card max-w-md p-6 text-center">
          <p className="text-sm font-semibold text-ink-950">We could not load your workspace</p>
          <p className="mt-1 text-[13px] text-ink-500">{error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
