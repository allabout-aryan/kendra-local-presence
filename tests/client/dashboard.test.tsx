// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Next's navigation hooks need a router that a jsdom render does not have.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href: typeof href === 'string' ? href : '#', ...rest }, children),
}));

import { KendraProvider } from '@/lib/data/store';
import { ToastProvider } from '@/components/ui/overlay';
import { buildDemoDataset } from '@/lib/data/demo';
import DashboardPage from '@/app/dashboard/page';
import ReviewsPage from '@/app/reviews/page';

const DEMO_LOCATIONS = buildDemoDataset().locations.map((location) => location.name);

/** Renders a page inside the same providers the root layout supplies. */
function renderPage(element: React.ReactElement) {
  return render(
    React.createElement(KendraProvider, null, React.createElement(ToastProvider, null, element)),
  );
}

describe('dashboard renders the demo workspace in a browser-like environment', () => {
  it('mounts, loads the dataset and shows computed KPIs', async () => {
    renderPage(React.createElement(DashboardPage));

    await waitFor(() => expect(screen.getByText('Portfolio overview')).toBeTruthy(), { timeout: 5000 });

    // KPI labels from the computed portfolio rollup
    expect(screen.getByText('Avg audit score')).toBeTruthy();
    expect(screen.getByText('Open reviews')).toBeTruthy();
    expect(screen.getByText('Biggest wins available')).toBeTruthy();
    expect(screen.getByText('Needs attention')).toBeTruthy();

    // the demo banner must be present so nobody mistakes sample data for live
    expect(screen.getAllByText(/Demo workspace/i).length).toBeGreaterThan(0);

    // the workspace name from the seeded organisation appears in the header
    expect(screen.getAllByText(/Blue Tokai Retail/).length).toBeGreaterThan(0);

    // and at least one real outlet from the dataset is rendered somewhere
    const body = document.body.textContent ?? '';
    expect(DEMO_LOCATIONS.some((name) => body.includes(name))).toBe(true);
  });
});

describe('reviews inbox renders real rows', () => {
  it('lists reviews with reply affordances', async () => {
    renderPage(React.createElement(ReviewsPage));
    await waitFor(() => expect(screen.getAllByText('Reviews').length).toBeGreaterThan(0), { timeout: 5000 });
    await waitFor(() => {
      const replies = screen.getAllByRole('button', { name: /^Reply$/ });
      expect(replies.length).toBeGreaterThan(0);
    });
  });
});
