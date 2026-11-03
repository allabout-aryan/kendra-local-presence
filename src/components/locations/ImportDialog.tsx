'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Upload } from 'lucide-react';
import { Badge, Button, Field, Textarea } from '@/components/ui/primitives';
import { Modal, useToast } from '@/components/ui/overlay';
import { SAMPLE_CSV, parseCsv, previewImport, type ImportPreview } from '@/lib/domain/csvImport';
import { useStore } from '@/lib/data/store';

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { importOutlets } = useStore();
  const { push } = useToast();
  const [text, setText] = React.useState('');
  const [filename, setFilename] = React.useState('pasted.csv');
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const analyse = (content: string, name: string) => {
    setText(content);
    setFilename(name);
    const parsed = parseCsv(content);
    const result = previewImport(parsed);
    setPreview(result);
    if (parsed.errors.length > 0) {
      push({ tone: 'error', title: 'Could not read the file', description: parsed.errors[0] });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    analyse(content, file.name);
  };

  const run = async () => {
    if (!preview || preview.valid.length === 0) return;
    setBusy(true);
    try {
      const result = await importOutlets(preview.valid.map((row) => row.value), filename);
      push({
        tone: 'success',
        title: `${result.imported} outlets imported`,
        description: result.failed > 0 ? `${result.failed} rows could not be written.` : 'They are in the portfolio now.',
      });
      setPreview(null);
      setText('');
      onClose();
    } catch (error) {
      push({ tone: 'error', title: 'Import failed', description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import outlets from CSV"
      description="Columns are matched by name, so an export from Sheets or your POS usually works unchanged."
      width="lg"
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={() => analyse(SAMPLE_CSV, 'sample.csv')}>
            Load sample
          </Button>
          <Button size="sm" variant="primary" loading={busy} disabled={!preview || preview.valid.length === 0} onClick={run}>
            Import {preview?.valid.length ?? 0} outlet{preview?.valid.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} icon={<FileUp className="h-3.5 w-3.5" />}>
            Choose a file
          </Button>
          <span className="text-[11px] text-ink-400">or paste below · first row must be the header</span>
        </div>

        <Field label="CSV content" hint="outlet, code, city, state, pin, phone, category">
          <Textarea
            value={text}
            onChange={(event) => analyse(event.target.value, 'pasted.csv')}
            rows={5}
            className="font-mono text-[11px]"
            placeholder={'outlet,city,pin,phone\nIndiranagar,Bengaluru,560038,9876543210'}
          />
        </Field>

        {preview && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <Badge tone={preview.valid.length > 0 ? 'positive' : 'neutral'}>{preview.valid.length} ready</Badge>
              {preview.issues.length > 0 && <Badge tone="danger">{preview.issues.length} issue(s)</Badge>}
              {preview.duplicatesInFile.length > 0 && <Badge tone="warning">{preview.duplicatesInFile.length} duplicate row(s)</Badge>}
              <span className="text-ink-400">{preview.total} rows read</span>
            </div>

            {preview.valid.length > 0 && (
              <div className="max-h-[160px] overflow-y-auto rounded-lg border border-ink-200">
                <table className="w-full text-[12px]">
                  <thead className="bg-ink-50 text-ink-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Row</th>
                      <th className="px-2 py-1.5 text-left font-medium">Outlet</th>
                      <th className="px-2 py-1.5 text-left font-medium">City</th>
                      <th className="px-2 py-1.5 text-left font-medium">PIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.slice(0, 40).map((row) => (
                      <tr key={row.row} className="border-t border-ink-100">
                        <td className="tabular px-2 py-1 text-ink-400">{row.row}</td>
                        <td className="px-2 py-1 text-ink-900">{row.value.name}</td>
                        <td className="px-2 py-1 text-ink-600">{row.value.city || '—'}</td>
                        <td className="tabular px-2 py-1 text-ink-600">{row.value.postal_code || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.issues.length > 0 && (
              <ul className="max-h-[120px] space-y-1 overflow-y-auto rounded-lg bg-brick-50 p-2">
                {preview.issues.slice(0, 12).map((issue, index) => (
                  <li key={index} className="flex gap-1.5 text-[11px] text-brick-700">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    Row {issue.row}: {issue.field} — {issue.message}
                  </li>
                ))}
              </ul>
            )}

            {preview.duplicatesInFile.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-amber-50 p-2">
                {preview.duplicatesInFile.map((message, index) => (
                  <li key={index} className="text-[11px] text-amber-700">{message}</li>
                ))}
              </ul>
            )}

            {preview.valid.length === 0 && preview.issues.length === 0 && (
              <p className="flex items-center gap-1.5 text-[12px] text-ink-500">
                <Upload className="h-3.5 w-3.5" /> Nothing to import yet.
              </p>
            )}
            {preview.valid.length > 0 && preview.issues.length === 0 && (
              <p className="flex items-center gap-1.5 text-[12px] text-pine-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Every row validated.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
