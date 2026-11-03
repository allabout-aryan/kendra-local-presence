'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button, Field, Input, Tabs } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/overlay';
import { supabaseReady, useStore } from '@/lib/data/store';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, signInWithOtp, enterDemo, user, org } = useStore();
  const { push } = useToast();
  const [tab, setTab] = React.useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user && org) router.replace('/dashboard');
    else if (user) router.replace('/onboarding');
  }, [user, org, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (tab === 'signin') {
        await signIn(email.trim(), password);
        push({ tone: 'success', title: 'Signed in' });
        router.push('/dashboard');
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password, fullName.trim() || email.split('@')[0]);
        if (needsConfirmation) {
          push({
            tone: 'info',
            title: 'Check your inbox',
            description: 'Confirm your email address to finish setting up your workspace.',
          });
        } else {
          router.push('/onboarding');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const magicLink = async () => {
    if (!email.trim()) {
      setError('Enter your email first');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithOtp(email.trim());
      push({ tone: 'success', title: 'Magic link sent', description: `Check ${email.trim()} for a sign-in link.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the link');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-pine-600 text-[13px] font-bold text-white">K</span>
            <span className="text-[15px] font-semibold tracking-[-0.01em]">Kendra</span>
          </Link>
          <Link href="/" className="flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[22px] tracking-[-0.01em]">{tab === 'signin' ? 'Sign in to Kendra' : 'Create your workspace'}</h1>
          <p className="mt-1.5 text-[13px] text-ink-500">
            {tab === 'signin'
              ? 'Manage every outlet of your brand from one place.'
              : 'Set up your brand, then connect Google Business Profile.'}
          </p>

          <Tabs
            className="mt-5"
            value={tab}
            onChange={(value) => {
              setTab(value);
              setError(null);
            }}
            tabs={[
              { value: 'signin', label: 'Sign in' },
              { value: 'signup', label: 'Create account' },
            ]}
          />

          {!supabaseReady && (
            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-700">
              This build has no Supabase project configured, so sign-in is disabled. Open the demo workspace instead —
              it is fully interactive.
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {tab === 'signup' && (
              <Field label="Your name" htmlFor="name">
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aarti Rao" autoComplete="name" />
              </Field>
            )}
            <Field label="Work email" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@brand.com"
                autoComplete="email"
                disabled={!supabaseReady}
              />
            </Field>
            <Field label="Password" htmlFor="password" required hint={tab === 'signup' ? 'At least 8 characters.' : undefined}>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                disabled={!supabaseReady}
              />
            </Field>

            {error && (
              <p className="rounded-lg bg-brick-50 px-3 py-2 text-[12px] text-brick-700" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={busy} disabled={!supabaseReady}>
              {tab === 'signin' ? 'Sign in' : 'Create account'}
            </Button>

            {tab === 'signin' && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full justify-center"
                onClick={magicLink}
                disabled={!supabaseReady || busy}
                icon={<Mail className="h-4 w-4" />}
              >
                Email me a sign-in link
              </Button>
            )}
          </form>

          {supabaseReady && (
            <div className="mt-4 rounded-lg border border-pine-100 bg-pine-50 p-3">
              <p className="text-[12px] font-medium text-pine-700">Seeded demo account</p>
              <p className="mt-0.5 font-mono text-[11px] text-pine-700">aarti@bluetokai.test · kendra-demo-1234</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => {
                  setTab('signin');
                  setEmail('aarti@bluetokai.test');
                  setPassword('kendra-demo-1234');
                }}
              >
                Fill these in
              </Button>
            </div>
          )}

          {supabaseReady && (
            <div className="mt-4 rounded-lg border border-pine-100 bg-pine-50 p-3">
              <p className="text-[12px] font-medium text-pine-700">Seeded demo account</p>
              <p className="mt-0.5 font-mono text-[11px] text-pine-700">aarti@bluetokai.test · kendra-demo-1234</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => {
                  setTab('signin');
                  setEmail('aarti@bluetokai.test');
                  setPassword('kendra-demo-1234');
                }}
              >
                Fill these in
              </Button>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-200" />
            <span className="text-[10px] uppercase tracking-wide text-ink-400">or</span>
            <div className="h-px flex-1 bg-ink-200" />
          </div>

          <Button
            variant="ghost"
            className="mt-4 w-full justify-center"
            onClick={() => {
              enterDemo();
              router.push('/dashboard');
            }}
          >
            Explore the demo workspace
          </Button>
        </div>
      </div>

      <aside className="hidden border-l border-ink-200 bg-ink-950 p-10 lg:flex lg:flex-col lg:justify-center">
        <blockquote className="max-w-[38ch]">
          <p className="text-[19px] leading-relaxed text-white">
            “We were running 34 outlets across four states off a spreadsheet. Wrong festive hours cost us walk-ins
            every single festival. Now the audit score is the first thing I open on a Monday.”
          </p>
          <footer className="mt-5 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pine-600 text-[12px] font-semibold text-white">AR</span>
            <div>
              <p className="text-[12px] font-medium text-white">Aarti Rao</p>
              <p className="text-[11px] text-ink-500">Head of Retail Marketing</p>
            </div>
          </footer>
        </blockquote>
        <div className="mt-10 grid grid-cols-3 gap-4 border-t border-ink-800 pt-6">
          {[
            { value: '13', label: 'audit rules' },
            { value: '1', label: 'screen for all outlets' },
            { value: 'RLS', label: 'tenant isolation' },
          ].map((item) => (
            <div key={item.label}>
              <p className="tabular text-lg font-semibold text-white">{item.value}</p>
              <p className="text-[11px] text-ink-500">{item.label}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
