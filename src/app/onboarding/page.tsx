'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/overlay';
import { useStore } from '@/lib/data/store';
import { firstError, orgCreateSchema } from '@/lib/domain/validation';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function OnboardingPage() {
  const router = useRouter();
  const { createOrg, user, org, orgs } = useStore();
  const { push } = useToast();
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) router.replace('/login');
  }, [user, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = orgCreateSchema.safeParse({ name, slug });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createOrg(parsed.data.name, parsed.data.slug);
      push({ tone: 'success', title: 'Workspace ready', description: 'Next: add your first outlet.' });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the workspace');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-5 py-10">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-pine-600 text-[13px] font-bold text-white">K</span>
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Kendra</span>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-pine-50 text-pine-600 ring-1 ring-inset ring-pine-100">
            <Building2 className="h-4.5 w-4.5" aria-hidden />
          </div>
          <h1 className="text-[19px] tracking-[-0.01em]">Name your brand workspace</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
            A workspace holds every outlet, review and report for one brand. You can invite your team once it exists.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Brand name" htmlFor="brand" required error={error ?? undefined}>
              <Input
                id="brand"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!slugTouched) setSlug(slugify(event.target.value));
                }}
                placeholder="Blue Tokai Retail"
                autoFocus
                invalid={Boolean(error)}
              />
            </Field>

            <Field label="Workspace URL" htmlFor="slug" hint={`kendra.app/${slug || 'your-brand'}`}>
              <Input
                id="slug"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                placeholder="blue-tokai-retail"
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={busy}>
              Create workspace
            </Button>
          </form>
        </div>

        {orgs.length > 0 && (
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 w-full text-center text-[12px] text-ink-500 hover:text-ink-900"
          >
            You already have {orgs.length} workspace{orgs.length > 1 ? 's' : ''} — go back to {org?.name ?? 'dashboard'}
          </button>
        )}
      </div>
    </div>
  );
}
