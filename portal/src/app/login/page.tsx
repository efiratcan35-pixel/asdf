'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';

function readTokenPayload() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload)) as { role?: string; contractorType?: string };
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { login, refreshMe, user } = useAuth();

  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(identifier, password, method);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    await refreshMe();

    const tokenPayload = readTokenPayload();
    const role = user?.role ?? tokenPayload?.role;
    const contractorType = user?.contractorType ?? tokenPayload?.contractorType;

    if (role === 'investor') {
      router.push('/dashboard/investor');
      return;
    }
    if (role === 'contractor' && contractorType === 'TAXED') {
      router.push('/dashboard/contractor');
      return;
    }
    if (role === 'contractor' && contractorType === 'UNTAXED') {
      router.push('/dashboard/subcontractor');
      return;
    }

    router.push('/');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <TopBar />
      <div className="w-full max-w-md rounded-xl bg-white shadow p-6">
        <h1 className="text-2xl font-semibold">Giris Yap</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Giris yontemi</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value as 'email' | 'phone')}
            >
              <option value="email">Mail ile</option>
              <option value="phone">Telefon ile</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">{method === 'email' ? 'Email' : 'Telefon numarasi'}</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete={method === 'email' ? 'email' : 'tel'}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Sifre</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <button
            disabled={loading}
            className="w-full rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-60"
            type="submit"
          >
            {loading ? 'Giris yapiliyor...' : 'Giris Yap'}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-600">
          Hesabin yok mu?{' '}
          <Link href="/register" className="font-semibold text-black underline">
            Uye ol
          </Link>
        </div>
      </div>
    </div>
  );
}
