'use client';

import * as React from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { AppShell, PageGuard } from '@/components/shell/AppShell';
import { Badge, Button, Card, CardHeader, EmptyState, Progress, Select } from '@/components/ui/primitives';
import { useAuditResults, useStore } from '@/lib/data/store';
import { ScoreTrend } from '@/components/ui/charts';
import { AUDIT_RULES, portfolioFixRanking, scoreBand } from '@/lib/domain/audit';
import { csvFilename, downloadCsv, toCsv } from '@/lib/domain/csv';
import { formatRelative } from '@/lib/domain/format';
import { useToast } from '@/components/ui/overlay';
import { cn } from '@/lib/utils';

function AuditInner() {
  const { data } = useStore();
  const audits = useAuditResults();
  const { push } = useToast();
  const [severity, setSeverity] = React.useState('all');

  const scoreTrend = React.useMemo(() => {
    const byDate = new Map<string, { total: number; count: number }>();
    for (const snapshot of data.auditSnapshots) {
      const entry = byDate.get(snapshot.captured_on) ?? { total: 0, count: 0 };
      entry.total += snapshot.score;
      entry.count += 1;
      byDate.set(snapshot.captured_on, entry);
    }
    return [...byDate.entries()]
      .map(([captured_on, entry]) => ({ captured_on, avg_score: Math.round((entry.total / entry.count) * 10) / 10 }))
      .sort((a, b) => a.captured_on.localeCompare(b.captured_on));
  }, [data.auditSnapshots]);

  const scores = audits.map((entry) => entry.result.score);
  const portfolioScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const fixRanking = portfolioFixRanking(audits.map((entry) => entry.result));
  const ruleWeights = new Map(AUDIT_RULES.map((rule) => [rule.key, rule.points]));

  const filtered = audits
    .map((entry) => ({
      ...entry,
      findings: entry.result.findings.filter((finding) => severity === 'all' || finding.severity === severity),
    }))
    .filter((entry) => entry.findings.length > 0)
    .sort((a, b) => a.result.score - b.result.score);

  const exportAudit = () => {
    const rows = audits.flatMap(({ location, result }) =>
      result.findings.length === 0
        ? [[location.name, location.city ?? '', 'pass', '—', '—', 0]]
        : result.findings.map((finding) => [location.name, location.city ?? '', finding.severity, finding.title, finding.detail, finding.points_lost]),
    );
    downloadCsv(
      csvFilename('kendra-audit'),
      toCsv(['Outlet', 'City', 'Severity', 'Finding', 'Detail', 'Points lost'], rows),
    );
    push({ tone: 'success', title: 'Audit exported', description: `${rows.length} rows written to CSV.` });
  };

  return (
    <AppShell
      title="Audit"
      subtitle="13 deterministic rules, scored per outlet"
      actions={
        <Button size="sm" variant="secondary" onClick={exportAudit} icon={<Download className="h-3.5 w-3.5" />}>
          <span className="hidden sm:inline">Export</span>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <p className="label-caps">Portfolio audit score</p>
            <p className="tabular mt-1 text-[38px] font-semibold leading-none tracking-[-0.02em] text-ink-950">
              {portfolioScore.toFixed(0)}
              <span className="text-[15px] font-normal text-ink-400">/100</span>
            </p>
            <Progress
              className="mt-3"
              value={portfolioScore}
              tone={portfolioScore >= 85 ? 'accent' : portfolioScore >= 65 ? 'warning' : 'danger'}
            />
            <p className="mt-2 text-[11px] text-ink-500">
              Across {audits.length} outlets · {audits.reduce((total, entry) => total + entry.result.findings.length, 0)} open findings
            </p>
            <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-ink-200 bg-ink-200">
              {[
                { label: 'Healthy', value: scores.filter((s) => s >= 85).length, tone: 'text-pine-700' },
                { label: 'Needs work', value: scores.filter((s) => s >= 65 && s < 85).length, tone: 'text-amber-700' },
                { label: 'Critical', value: scores.filter((s) => s < 65).length, tone: 'text-brick-700' },
              ].map((item) => (
                <div key={item.label} className="bg-white px-2 py-2 text-center">
                  <p className={cn('tabular text-[15px] font-semibold', item.tone)}>{item.value}</p>
                  <p className="text-[10px] text-ink-400">{item.label}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Score history" description="Portfolio average by day" />
            <div className="px-1 pb-1 pt-2">
              <ScoreTrend points={scoreTrend} height={110} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Fixes ranked by value" description="Total points recoverable" />
            <ul className="divide-y divide-ink-100">
              {fixRanking.map((fix, index) => (
                <li key={fix.rule_key} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="tabular w-4 text-[11px] font-semibold text-ink-300">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink-900">{fix.title}</p>
                    <p className="text-[10px] text-ink-400">
                      {fix.locations} outlet{fix.locations > 1 ? 's' : ''} · −{ruleWeights.get(fix.rule_key) ?? 0} pts each
                    </p>
                  </div>
                  <span className="tabular rounded bg-pine-50 px-1.5 py-0.5 text-[11px] font-semibold text-pine-700">+{fix.points}</span>
                </li>
              ))}
              {fixRanking.length === 0 && <li className="px-4 py-6 text-center text-[12px] text-ink-500">Every profile passes every rule.</li>}
            </ul>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Findings by outlet"
            description="Ordered by lowest score"
            action={
              <Select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filter by severity" className="w-auto">
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </Select>
            }
          />
          {filtered.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-4.5 w-4.5" />}
              title="No findings at this severity"
              description="Switch the severity filter, or celebrate — the portfolio is clean."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {filtered.map(({ location, result, findings }) => (
                <li key={location.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'tabular rounded px-1.5 py-0.5 text-[11px] font-semibold',
                        result.score >= 85 ? 'bg-pine-50 text-pine-700' : result.score >= 65 ? 'bg-amber-50 text-amber-700' : 'bg-brick-50 text-brick-700',
                      )}
                    >
                      {result.score}
                    </span>
                    <p className="text-[13px] font-medium text-ink-900">{location.name}</p>
                    <span className="text-[11px] text-ink-400">{location.city} · synced {formatRelative(location.last_synced_at)}</span>
                    <Badge className="ml-auto" tone={scoreBand(result.score) === 'healthy' ? 'positive' : scoreBand(result.score) === 'attention' ? 'warning' : 'danger'}>
                      {scoreBand(result.score)}
                    </Badge>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {findings.map((finding) => (
                      <li key={finding.rule_key} className="flex gap-2 rounded-md bg-ink-50/70 px-2.5 py-1.5">
                        <span
                          className={cn(
                            'mt-0.5 shrink-0 rounded px-1 text-[10px] font-semibold',
                            finding.severity === 'critical' ? 'bg-brick-100 text-brick-700' : finding.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-ink-200 text-ink-600',
                          )}
                        >
                          −{finding.points_lost}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-ink-900">{finding.title}</p>
                          <p className="text-[11px] leading-relaxed text-ink-500">{finding.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export default function AuditPage() {
  return (
    <PageGuard>
      <AuditInner />
    </PageGuard>
  );
}
